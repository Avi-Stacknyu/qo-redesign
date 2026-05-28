<script lang="ts">
	import { Button } from '$lib/components/shadcn/button';
	import { Badge } from '$lib/components/shadcn/badge';
	import * as Tooltip from '$lib/components/shadcn/tooltip';
	import Send from '@lucide/svelte/icons/send';
	import Paperclip from '@lucide/svelte/icons/paperclip';
	import X from '@lucide/svelte/icons/x';
	import Loader2 from '@lucide/svelte/icons/loader-2';
	import FileText from '@lucide/svelte/icons/file-text';
	import ImageIcon from '@lucide/svelte/icons/image';
	import FileSpreadsheet from '@lucide/svelte/icons/file-spreadsheet';
	import CheckCircle from '@lucide/svelte/icons/check-circle';
	import AlertCircle from '@lucide/svelte/icons/alert-circle';
	import Mic from '@lucide/svelte/icons/mic';
	import Square from '@lucide/svelte/icons/square';
	import MicOff from '@lucide/svelte/icons/mic-off';
	import type { ChatFileAttachment } from '@repo/shared/types';
	import {
		SUPPORTED_MIME_TYPES,
		SUPPORTED_FILE_EXTENSIONS,
		formatFileSize
	} from '@repo/shared/utils';
	import { transcribeAudio as transcribeAudioRemote } from '$lib/remote/transcription.remote';
	import { toast } from 'svelte-sonner';

	interface UploadingFile {
		file: File;
		progress: number;
		status: 'uploading' | 'processing' | 'completed' | 'error';
		uploadedData?: ChatFileAttachment;
		error?: string;
	}

	interface Props {
		threadId: string;
		disabled?: boolean;
		isSending?: boolean;
		onSubmit: (message: string, files?: ChatFileAttachment[]) => void;
	}

	let { threadId, disabled = false, isSending = false, onSubmit }: Props = $props();

	let message = $state('');
	let textarea: HTMLTextAreaElement | undefined = $state();
	let fileInput: HTMLInputElement | undefined = $state();
	let uploadingFiles = $state<UploadingFile[]>([]);

	// Voice recording state
	let isRecording = $state(false);
	let isTranscribing = $state(false);
	let mediaRecorder: MediaRecorder | null = $state(null);
	let audioChunks: Blob[] = $state([]);
	let recordingDuration = $state(0);
	let recordingInterval: ReturnType<typeof setInterval> | null = null;

	// Audio visualization state
	let audioContext: AudioContext | null = null;
	let analyser: AnalyserNode | null = null;
	let audioStream: MediaStream | null = null;
	let waveformBars = $state<number[]>(Array(12).fill(4));
	let animationFrameId: number | null = null;

	// Minimum recording duration (in seconds)
	const MIN_RECORDING_DURATION = 1;

	// Use shared constants from @repo/shared/utils
	const MIME_TYPES = SUPPORTED_MIME_TYPES as readonly string[];
	const EXTENSIONS = SUPPORTED_FILE_EXTENSIONS as readonly string[];

	// Check if all files are ready
	let allFilesReady = $derived(
		uploadingFiles.length === 0 || uploadingFiles.every((f) => f.status === 'completed')
	);

	let hasError = $derived(uploadingFiles.some((f) => f.status === 'error'));

	function handleSubmit() {
		if (!message.trim() || disabled || isSending || !allFilesReady) return;

		const completedFiles: ChatFileAttachment[] = uploadingFiles
			.filter((uf) => uf.status === 'completed' && uf.uploadedData)
			.map((uf) => uf.uploadedData!);

		onSubmit(message.trim(), completedFiles.length > 0 ? completedFiles : undefined);
		message = '';
		uploadingFiles = [];
		if (textarea) textarea.style.height = 'auto';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSubmit();
		}
	}

	function handleInput() {
		if (textarea) {
			textarea.style.height = 'auto';
			textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
		}
	}

	async function handleFileSelect(e: Event) {
		const target = e.target as HTMLInputElement;
		if (!target.files || target.files.length === 0) return;

		for (const file of Array.from(target.files)) {
			// Validate file type
			const isValidType =
				MIME_TYPES.includes(file.type) ||
				EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));

			if (!isValidType) {
				console.warn(`Unsupported file type: ${file.name}`);
				continue;
			}

			const uploadingFile: UploadingFile = {
				file,
				progress: 0,
				status: 'uploading'
			};

			uploadingFiles = [...uploadingFiles, uploadingFile];
			uploadFile(uploadingFile);
		}

		target.value = '';
	}

	async function uploadFile(uploadingFile: UploadingFile) {
		try {
			const formData = new FormData();
			formData.append('file', uploadingFile.file);
			formData.append('scope', 'chat');

			const xhr = new XMLHttpRequest();

			xhr.upload.addEventListener('progress', (e) => {
				if (e.lengthComputable) {
					const progress = Math.round((e.loaded / e.total) * 100);
					uploadingFiles = uploadingFiles.map((uf) =>
						uf.file === uploadingFile.file ? { ...uf, progress } : uf
					);

					if (progress === 100) {
						uploadingFiles = uploadingFiles.map((uf) =>
							uf.file === uploadingFile.file ? { ...uf, status: 'processing' } : uf
						);
					}
				}
			});

			xhr.addEventListener('load', async () => {
				if (xhr.status === 200) {
					try {
						const result = JSON.parse(xhr.responseText);
						const fileData: ChatFileAttachment = {
							id: result.file.id,
							name: result.file.name,
							size: result.file.size,
							type: result.file.type,
							url: result.file.url || ''
						};

						// If file is still processing, register for batch polling
						if (result.file.status === 'processing' && result.file.id) {
							uploadingFiles = uploadingFiles.map((uf) =>
								uf.file === uploadingFile.file
									? { ...uf, status: 'processing', uploadedData: fileData }
									: uf
							);

							registerForPolling(result.file.id, uploadingFile.file);
						} else {
							uploadingFiles = uploadingFiles.map((uf) =>
								uf.file === uploadingFile.file
									? { ...uf, status: 'completed', progress: 100, uploadedData: fileData }
									: uf
							);
						}
					} catch (parseError) {
						console.error('Failed to parse upload response:', parseError);
						uploadingFiles = uploadingFiles.map((uf) =>
							uf.file === uploadingFile.file
								? { ...uf, status: 'error', error: 'Invalid response' }
								: uf
						);
					}
				} else {
					let errorMsg = 'Upload failed';
					try {
						const errData = JSON.parse(xhr.responseText);
						errorMsg = errData.message || errData.error || errorMsg;
					} catch {
						// Use default error
					}
					uploadingFiles = uploadingFiles.map((uf) =>
						uf.file === uploadingFile.file ? { ...uf, status: 'error', error: errorMsg } : uf
					);
				}
			});

			xhr.addEventListener('error', () => {
				uploadingFiles = uploadingFiles.map((uf) =>
					uf.file === uploadingFile.file ? { ...uf, status: 'error', error: 'Network error' } : uf
				);
			});

			// Use admin API endpoint for playground uploads
			xhr.open('POST', `/api/playground/${threadId}/upload`);
			xhr.send(formData);
		} catch (error) {
			console.error('Upload error:', error);
			uploadingFiles = uploadingFiles.map((uf) =>
				uf.file === uploadingFile.file ? { ...uf, status: 'error', error: 'Upload failed' } : uf
			);
		}
	}

	/**
	 * Unified batch polling — one loop checks all processing files at once
	 */
	let pollingTimer: ReturnType<typeof setTimeout> | null = null;
	let pollingAttempts = 0;
	const MAX_POLL_ATTEMPTS = 30;
	let fileIdMap = $state<Map<string, File>>(new Map());

	// Progressive backoff: 2s → 3s → 5s
	function getPollInterval(): number {
		if (pollingAttempts < 3) return 2000;
		if (pollingAttempts < 10) return 3000;
		return 5000;
	}

	function registerForPolling(fileId: string, originalFile: File) {
		fileIdMap.set(fileId, originalFile);
		fileIdMap = new Map(fileIdMap);
		if (!pollingTimer) {
			pollingAttempts = 0;
			pollingTimer = setTimeout(batchPoll, getPollInterval());
		}
	}

	async function batchPoll() {
		pollingTimer = null;

		const pendingIds = [...fileIdMap.keys()].filter((id) => {
			const file = fileIdMap.get(id);
			return file && uploadingFiles.some((uf) => uf.file === file && uf.status === 'processing');
		});

		if (pendingIds.length === 0) {
			fileIdMap = new Map();
			return;
		}

		if (pollingAttempts >= MAX_POLL_ATTEMPTS) {
			// Timeout — mark as completed (processing continues in background)
			uploadingFiles = uploadingFiles.map((uf) =>
				uf.status === 'processing' ? { ...uf, status: 'completed', progress: 100 } : uf
			);
			fileIdMap = new Map();
			return;
		}

		try {
			const response = await fetch(`/api/playground/${threadId}/files/status`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ fileIds: pendingIds })
			});
			if (!response.ok) throw new Error('Failed to check status');

			const statuses: Record<
				string,
				{ id: string; name: string; size: number; type: string; status: string }
			> = await response.json();

			for (const [fileId, status] of Object.entries(statuses)) {
				const originalFile = fileIdMap.get(fileId);
				if (!originalFile) continue;

				if (status.status === 'ready') {
					uploadingFiles = uploadingFiles.map((uf) =>
						uf.file === originalFile ? { ...uf, status: 'completed', progress: 100 } : uf
					);
					fileIdMap.delete(fileId);
				} else if (status.status === 'failed') {
					uploadingFiles = uploadingFiles.map((uf) =>
						uf.file === originalFile ? { ...uf, status: 'error', error: 'Processing failed' } : uf
					);
					fileIdMap.delete(fileId);
				}
			}
			fileIdMap = new Map(fileIdMap);
		} catch {
			// Network error — will retry on next tick
		}

		pollingAttempts++;

		const stillProcessing = uploadingFiles.some((uf) => uf.status === 'processing');
		if (stillProcessing) {
			pollingTimer = setTimeout(batchPoll, getPollInterval());
		} else {
			fileIdMap = new Map();
		}
	}

	function removeFile(uploadingFile: UploadingFile) {
		uploadingFiles = uploadingFiles.filter((uf) => uf.file !== uploadingFile.file);
	}

	function getFileIcon(type: string) {
		if (type.startsWith('image/')) return ImageIcon;
		if (type.includes('spreadsheet') || type.includes('excel') || type === 'text/csv')
			return FileSpreadsheet;
		return FileText;
	}

	// Voice recording functions
	async function startRecording() {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			audioStream = stream;

			// Set up audio visualization
			audioContext = new AudioContext();
			analyser = audioContext.createAnalyser();
			const source = audioContext.createMediaStreamSource(stream);
			source.connect(analyser);
			analyser.fftSize = 64;

			// Start waveform animation
			updateWaveform();

			const recorder = new MediaRecorder(stream, {
				mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
					? 'audio/webm;codecs=opus'
					: 'audio/webm'
			});

			audioChunks = [];
			recordingDuration = 0;

			recorder.ondataavailable = (e) => {
				if (e.data.size > 0) {
					audioChunks = [...audioChunks, e.data];
				}
			};

			recorder.onstop = async () => {
				// Stop visualization
				if (animationFrameId) {
					cancelAnimationFrame(animationFrameId);
					animationFrameId = null;
				}
				if (audioContext) {
					audioContext.close();
					audioContext = null;
				}
				waveformBars = Array(12).fill(4);

				// Stop all tracks
				stream.getTracks().forEach((track) => track.stop());
				audioStream = null;

				// Clear interval
				if (recordingInterval) {
					clearInterval(recordingInterval);
					recordingInterval = null;
				}

				// Check for minimum duration
				if (recordingDuration < MIN_RECORDING_DURATION) {
					toast.error('Recording too short. Please speak for at least 1 second.');
					return;
				}

				if (audioChunks.length === 0) {
					toast.error('No audio recorded. Please check your microphone.');
					return;
				}

				const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });

				// Check blob size (very small = likely silence)
				if (audioBlob.size < 1000) {
					toast.error('No audio detected. Please speak louder.');
					return;
				}

				await transcribeAudio(audioBlob);
			};

			recorder.start(100);
			mediaRecorder = recorder;
			isRecording = true;

			// Start duration timer
			recordingInterval = setInterval(() => {
				recordingDuration += 1;
				if (recordingDuration >= 120) {
					stopRecording();
					toast.info('Recording stopped (max 2 minutes)');
				}
			}, 1000);
		} catch (err) {
			console.error('Failed to start recording:', err);
			if (err instanceof Error && err.name === 'NotAllowedError') {
				toast.error('Microphone permission denied.');
			} else if (err instanceof Error && err.name === 'NotFoundError') {
				toast.error('No microphone found.');
			} else {
				toast.error('Failed to start recording.');
			}
		}
	}

	function updateWaveform() {
		if (!analyser || !isRecording) return;

		const dataArray = new Uint8Array(analyser.frequencyBinCount);
		analyser.getByteFrequencyData(dataArray);

		const bars: number[] = [];
		const step = Math.floor(dataArray.length / 12);
		for (let i = 0; i < 12; i++) {
			const value = dataArray[i * step];
			bars.push(Math.max(4, Math.min(24, (value / 255) * 24)));
		}
		waveformBars = bars;

		animationFrameId = requestAnimationFrame(updateWaveform);
	}

	function stopRecording() {
		if (mediaRecorder && mediaRecorder.state !== 'inactive') {
			mediaRecorder.stop();
			isRecording = false;
		}
	}

	function cancelRecording() {
		if (animationFrameId) {
			cancelAnimationFrame(animationFrameId);
			animationFrameId = null;
		}
		if (audioContext) {
			audioContext.close();
			audioContext = null;
		}
		if (audioStream) {
			audioStream.getTracks().forEach((track) => track.stop());
			audioStream = null;
		}
		if (recordingInterval) {
			clearInterval(recordingInterval);
			recordingInterval = null;
		}
		if (mediaRecorder && mediaRecorder.state !== 'inactive') {
			mediaRecorder.stop();
		}
		isRecording = false;
		audioChunks = [];
		recordingDuration = 0;
		waveformBars = Array(12).fill(4);
	}

	async function transcribeAudio(audioBlob: Blob) {
		isTranscribing = true;

		try {
			const arrayBuffer = await audioBlob.arrayBuffer();
			const bytes = new Uint8Array(arrayBuffer);
			let binary = '';
			for (let i = 0; i < bytes.length; i++) {
				binary += String.fromCharCode(bytes[i]);
			}
			const audioBase64 = btoa(binary);

			const result = await transcribeAudioRemote({
				audioBase64,
				audioDurationMs: recordingDuration * 1000
			});

			if (result.text && result.text.trim()) {
				const trimmedText = result.text.trim();
				if (message) {
					message = message + ' ' + trimmedText;
				} else {
					message = trimmedText;
				}
				await new Promise((r) => setTimeout(r, 0));
				if (textarea) {
					textarea.focus();
					textarea.style.height = 'auto';
					textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
				}
			} else {
				toast.error('No speech detected. Please try again.');
			}
		} catch (err) {
			console.error('Transcription error:', err);
			toast.error(err instanceof Error ? err.message : 'Transcription failed');
		} finally {
			isTranscribing = false;
		}
	}

	function formatDuration(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}
</script>

<div class="border-t bg-background p-3">
	<!-- File attachments preview -->
	{#if uploadingFiles.length > 0}
		<div class="mb-2 flex flex-wrap gap-2">
			{#each uploadingFiles as uf}
				{@const FileIcon = getFileIcon(uf.file.type)}
				<div
					class="group relative flex items-center gap-2 rounded-md border bg-muted/50 px-2 py-1.5 text-xs"
				>
					<div class="flex h-6 w-6 items-center justify-center rounded bg-background">
						{#if uf.status === 'uploading' || uf.status === 'processing'}
							<Loader2 class="h-3.5 w-3.5 animate-spin text-muted-foreground" />
						{:else if uf.status === 'completed'}
							<CheckCircle class="h-3.5 w-3.5 text-green-500" />
						{:else if uf.status === 'error'}
							<AlertCircle class="h-3.5 w-3.5 text-red-500" />
						{:else}
							<FileIcon class="h-3.5 w-3.5 text-muted-foreground" />
						{/if}
					</div>

					<div class="flex flex-col">
						<span class="max-w-30 truncate font-medium">{uf.file.name}</span>
						<span class="text-[10px] text-muted-foreground">
							{#if uf.status === 'uploading'}
								{uf.progress}%
							{:else if uf.status === 'processing'}
								Processing...
							{:else if uf.status === 'error'}
								{uf.error}
							{:else}
								{formatFileSize(uf.file.size)}
							{/if}
						</span>
					</div>

					<button
						type="button"
						class="ml-1 rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-background"
						onclick={() => removeFile(uf)}
					>
						<X class="h-3 w-3" />
					</button>

					<!-- Progress bar -->
					{#if uf.status === 'uploading'}
						<div class="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden rounded-b bg-muted">
							<div class="h-full bg-primary transition-all" style="width: {uf.progress}%"></div>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<!-- Input area -->
	<form
		class="flex items-end gap-2"
		onsubmit={(e) => {
			e.preventDefault();
			handleSubmit();
		}}
	>
		<!-- File upload button -->
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						type="button"
						variant="ghost"
						size="icon"
						class="h-9 w-9 shrink-0"
						onclick={() => fileInput?.click()}
						disabled={disabled || isSending || isRecording || isTranscribing}
					>
						<Paperclip class="h-4 w-4" />
					</Button>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content>
				<p>Attach files (PDF, images, documents)</p>
			</Tooltip.Content>
		</Tooltip.Root>

		<input
			bind:this={fileInput}
			type="file"
			multiple
			accept={EXTENSIONS.join(',')}
			class="hidden"
			onchange={handleFileSelect}
		/>

		<!-- Voice Recording UI -->
		{#if isRecording}
			<div
				class="flex flex-1 items-center gap-2 rounded-md border bg-red-50 px-3 py-2 dark:bg-red-950/30"
			>
				<div class="flex items-center gap-1">
					{#each waveformBars as height}
						<div
							class="w-1 rounded-full bg-red-500 transition-all duration-75"
							style="height: {height}px"
						></div>
					{/each}
				</div>
				<span class="text-sm font-medium text-red-600 dark:text-red-400"
					>{formatDuration(recordingDuration)}</span
				>
				<div class="flex-1"></div>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					class="h-7 text-muted-foreground hover:text-foreground"
					onclick={cancelRecording}
				>
					<MicOff class="mr-1 h-3.5 w-3.5" />
					Cancel
				</Button>
				<Button
					type="button"
					variant="default"
					size="sm"
					class="h-7 bg-red-600 hover:bg-red-700"
					onclick={stopRecording}
				>
					<Square class="mr-1 h-3 w-3" />
					Stop
				</Button>
			</div>
		{:else if isTranscribing}
			<div
				class="flex flex-1 items-center justify-center gap-2 rounded-md border bg-muted/50 px-3 py-2"
			>
				<Loader2 class="h-4 w-4 animate-spin text-primary" />
				<span class="text-sm text-muted-foreground">Transcribing...</span>
			</div>
		{:else}
			<!-- Text input -->
			<textarea
				bind:this={textarea}
				bind:value={message}
				onkeydown={handleKeydown}
				oninput={handleInput}
				placeholder="Type a message..."
				disabled={disabled || isSending}
				rows={1}
				class="max-h-37.5 min-h-9 flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
			></textarea>
		{/if}

		<!-- Voice recording button -->
		{#if !isRecording && !isTranscribing}
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<Button
							{...props}
							type="button"
							variant="ghost"
							size="icon"
							class="h-9 w-9 shrink-0"
							onclick={startRecording}
							disabled={disabled || isSending}
						>
							<Mic class="h-4 w-4" />
						</Button>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content>
					<p>Record voice message</p>
				</Tooltip.Content>
			</Tooltip.Root>
		{/if}

		<!-- Send button -->
		<Button
			type="submit"
			size="icon"
			class="h-9 w-9 shrink-0"
			disabled={!message.trim() ||
				disabled ||
				isSending ||
				!allFilesReady ||
				hasError ||
				isRecording ||
				isTranscribing}
		>
			{#if isSending}
				<Loader2 class="h-4 w-4 animate-spin" />
			{:else}
				<Send class="h-4 w-4" />
			{/if}
		</Button>
	</form>
</div>
