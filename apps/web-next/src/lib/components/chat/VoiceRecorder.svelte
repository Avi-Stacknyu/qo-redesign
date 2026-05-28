<script lang="ts">
	import { Mic, X, Square, Loader2 } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { transcribeAudio as transcribeAudioRemote } from '$lib/remote/transcription.remote';

	let {
		threadId,
		disabled = false,
		isStreaming = false,
		onTranscription
	}: {
		threadId: string;
		disabled?: boolean;
		isStreaming?: boolean;
		onTranscription: (text: string) => void;
	} = $props();

	let isRecording = $state(false);
	let isTranscribing = $state(false);
	let mediaRecorder: MediaRecorder | null = $state(null);
	let audioChunks: Blob[] = $state([]);
	let recordingDuration = $state(0);
	let recordingInterval: ReturnType<typeof setInterval> | null = null;
	let audioContext: AudioContext | null = null;
	let audioStream: MediaStream | null = null;
	let animationFrameId: number | null = null;

	const MIN_RECORDING_DURATION = 1;

	async function startRecording() {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			audioStream = stream;
			audioContext = new AudioContext();

			const recorder = new MediaRecorder(stream, {
				mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
					? 'audio/webm;codecs=opus'
					: 'audio/webm'
			});

			audioChunks = [];
			recordingDuration = 0;

			recorder.ondataavailable = (e) => {
				if (e.data.size > 0) audioChunks = [...audioChunks, e.data];
			};

			recorder.onstop = async () => {
				cleanup();
				if (recordingDuration < MIN_RECORDING_DURATION) {
					toast.error('Recording too short. Please speak for at least 1 second.');
					return;
				}
				if (audioChunks.length === 0) {
					toast.error('No audio recorded.');
					return;
				}
				const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
				if (audioBlob.size < 1000) {
					toast.error('No audio detected.');
					return;
				}
				await transcribeAudio(audioBlob);
			};

			recorder.start(100);
			mediaRecorder = recorder;
			isRecording = true;

			recordingInterval = setInterval(() => {
				recordingDuration += 1;
				if (recordingDuration >= 120) {
					stopRecording();
					toast.info('Recording stopped (max 2 minutes)');
				}
			}, 1000);
		} catch (err) {
			if (err instanceof Error && err.name === 'NotAllowedError') {
				toast.error('Microphone permission denied.');
			} else if (err instanceof Error && err.name === 'NotFoundError') {
				toast.error('No microphone found.');
			} else {
				toast.error('Failed to start recording.');
			}
		}
	}

	function cleanup() {
		if (animationFrameId) {
			cancelAnimationFrame(animationFrameId);
			animationFrameId = null;
		}
		if (audioContext) {
			audioContext.close();
			audioContext = null;
		}
		if (audioStream) {
			audioStream.getTracks().forEach((t) => t.stop());
			audioStream = null;
		}
		if (recordingInterval) {
			clearInterval(recordingInterval);
			recordingInterval = null;
		}
	}

	function stopRecording() {
		if (mediaRecorder && mediaRecorder.state !== 'inactive') {
			mediaRecorder.stop();
			isRecording = false;
		}
	}

	function cancelRecording() {
		cleanup();
		if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
		isRecording = false;
		audioChunks = [];
		recordingDuration = 0;
	}

	async function transcribeAudio(audioBlob: Blob) {
		isTranscribing = true;
		try {
			const arrayBuffer = await audioBlob.arrayBuffer();
			const bytes = new Uint8Array(arrayBuffer);
			let binary = '';
			for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
			const audioBase64 = btoa(binary);

			const result = await transcribeAudioRemote({
				audioBase64,
				audioDurationMs: recordingDuration * 1000,
				chatId: threadId
			});
			if (result.text?.trim()) {
				onTranscription(result.text.trim());
			} else {
				toast.error('No speech detected.');
			}
		} catch (err) {
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

{#if isRecording}
	<div class="flex h-9 items-center gap-2 rounded-full bg-red-50 pr-1 pl-3 dark:bg-red-950/30">
		<span class="relative flex h-2 w-2">
			<span
				class="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"
			></span>
			<span class="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
		</span>
		<span class="text-sm font-medium text-red-600 tabular-nums dark:text-red-400"
			>{formatDuration(recordingDuration)}</span
		>
		<button
			type="button"
			onclick={cancelRecording}
			class="ml-1 flex h-7 w-7 items-center justify-center rounded-full text-red-400 transition-colors hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/50"
			title="Cancel"
		>
			<X class="h-4 w-4" />
		</button>
		<button
			type="button"
			onclick={stopRecording}
			class="flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white transition-colors hover:bg-red-600"
			title="Stop & transcribe"
		>
			<Square class="h-3 w-3 fill-current" />
		</button>
	</div>
{:else if isTranscribing}
	<div class="flex h-9 items-center gap-2 rounded-full bg-muted/50 px-3">
		<Loader2 class="h-4 w-4 animate-spin text-muted-foreground" />
		<span class="text-sm text-muted-foreground">Transcribing...</span>
	</div>
{:else}
	<button
		type="button"
		onclick={startRecording}
		disabled={disabled || isStreaming}
		class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
		title="Voice input"
	>
		<Mic class="h-5 w-5" />
	</button>
{/if}
