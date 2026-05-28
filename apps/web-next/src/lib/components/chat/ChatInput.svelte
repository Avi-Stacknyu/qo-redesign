<script lang="ts">
	import { Button } from '$lib/components/shadcn/button/index.js';
	import * as Tooltip from '$lib/components/shadcn/tooltip/index.js';
	import type { AvailableModel } from '$lib/remote/models.remote';
	import { cn } from '$lib/utils';
	import type { AgentSummary } from '$lib/utils/agents';
	import {
		CheckCircle,
		Loader2,
		Paperclip,
		Search,
		Send,
		X
	} from '@lucide/svelte';
	import type { ChatFileAttachment } from '@repo/shared/types';
	import type { PinnedModelInfo } from '@repo/shared/utils';
	import {
		SUPPORTED_FILE_EXTENSIONS,
		SUPPORTED_MIME_TYPES
	} from '@repo/shared/utils';
	import { SvelteMap } from 'svelte/reactivity';
	import AgentSelector from './AgentSelector.svelte';
	import CreditGate from './CreditGate.svelte';
	import ModelPicker from './ModelPicker.svelte';
	import VoiceRecorder from './VoiceRecorder.svelte';

	type UploadingFile = {
		file: File;
		progress: number;
		status: 'uploading' | 'processing' | 'completed' | 'error';
		uploadedData?: ChatFileAttachment;
		error?: string;
	};

	let {
		onSubmit,
		disabled = false,
		isStreaming = false,
		onStop,
		placeholder = 'Ask anything...',
		threadId,
		agents = [],
		selectedAgentId,
		onAgentChange,
		hideAgentSelector = false,
		availableModels = [],
		selectedModelId = null,
		onModelChange,
		allowedModelIds = null,
		pinnedModelInfo = null,
		creditBalance = null,
		hasSubscription = false,
		floating = true
	}: {
		onSubmit: (message: string, files?: ChatFileAttachment[]) => void;
		disabled?: boolean;
		isStreaming?: boolean;
		onStop?: () => void;
		placeholder?: string;
		threadId: string;
		agents?: AgentSummary[];
		selectedAgentId?: string;
		onAgentChange?: (agentId: string) => void;
		hideAgentSelector?: boolean;
		availableModels?: AvailableModel[];
		selectedModelId?: string | null;
		onModelChange?: (modelId: string | null) => void;
		/** When set, restricts which models appear as selectable. */
		allowedModelIds?: string[] | null;
		pinnedModelInfo?: PinnedModelInfo | null;
		/** When non-null, enables credit gate display. */
		creditBalance?: number | null;
		hasSubscription?: boolean;
		floating?: boolean;
	} = $props();

	const creditsBlocked = $derived(creditBalance !== null && creditBalance <= 0);

	let message = $state('');
	let textarea: HTMLTextAreaElement | undefined = $state();
	let fileInput: HTMLInputElement | undefined = $state();
	let uploadingFiles = $state<UploadingFile[]>([]);
	let isFocused = $state(false);

	let allFilesReady = $derived(
		uploadingFiles.length === 0 ||
			uploadingFiles.every((f) => f.status === 'completed' || f.status === 'error')
	);

	// Unified batch polling — one loop checks all processing files at once
	let pollingTimer: ReturnType<typeof setTimeout> | null = null;
	let pollingAttempts = 0;
	const MAX_POLL_ATTEMPTS = 40;

	// Map fileId → original File reference for state updates
	let fileIdMap = new SvelteMap<string, File>();

	// Progressive backoff: 2s → 3s → 5s
	function getPollInterval(): number {
		if (pollingAttempts < 3) return 2000;
		if (pollingAttempts < 10) return 3000;
		return 5000;
	}

	function registerForPolling(fileId: string, originalFile: File) {
		fileIdMap.set(fileId, originalFile);
		// Reset attempts when new files arrive so early polls stay fast
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
			fileIdMap.clear();
			return;
		}

		if (pollingAttempts >= MAX_POLL_ATTEMPTS) {
			uploadingFiles = uploadingFiles.map((uf) =>
				uf.status === 'processing' ? { ...uf, status: 'error', error: 'Processing timeout' } : uf
			);
			fileIdMap.clear();
			return;
		}

		try {
			const response = await fetch(`/api/chat/threads/${threadId}/files/status`, {
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
						uf.file === originalFile
							? {
									...uf,
									status: 'completed',
									progress: 100,
									uploadedData: {
										id: status.id,
										name: status.name,
										size: status.size,
										type: status.type,
										url: ''
									}
								}
							: uf
					);
					fileIdMap.delete(fileId);
				} else if (status.status === 'failed') {
					uploadingFiles = uploadingFiles.map((uf) =>
						uf.file === originalFile ? { ...uf, status: 'error', error: 'Processing failed' } : uf
					);
					fileIdMap.delete(fileId);
				}
			}
		} catch {
			// Network error — will retry on next tick
		}

		pollingAttempts++;

		// Continue if any files still processing
		const stillProcessing = uploadingFiles.some((uf) => uf.status === 'processing');
		if (stillProcessing) pollingTimer = setTimeout(batchPoll, getPollInterval());
		else fileIdMap.clear();
	}

	function handleSubmit() {
		if (creditsBlocked) return;
		const completedFiles = uploadingFiles
			.filter((uf) => uf.status === 'completed' && uf.uploadedData)
			.map((uf) => uf.uploadedData!);
		if (message.trim() && !disabled && !isStreaming && allFilesReady) {
			onSubmit(message.trim(), completedFiles.length > 0 ? completedFiles : undefined);
			message = '';
			uploadingFiles = [];
			if (textarea) {
				textarea.style.height = 'auto';
				textarea.style.height = '56px'; // Reset to min-height
			}
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSubmit();
		}
	}

	async function handleFileSelect(e: Event) {
		const target = e.target as HTMLInputElement;
		if (!target.files?.length) return;
		for (const file of Array.from(target.files)) {
			if (!(SUPPORTED_MIME_TYPES as readonly string[]).includes(file.type)) {
				const hasValidExt = SUPPORTED_FILE_EXTENSIONS.some((ext) =>
					file.name.toLowerCase().endsWith(ext)
				);
				if (!hasValidExt) continue;
			}
			const uf: UploadingFile = { file, progress: 0, status: 'uploading' };
			uploadingFiles = [...uploadingFiles, uf];
			uploadFile(uf);
		}
		target.value = '';
	}

	async function uploadFile(uploadingFile: UploadingFile) {
		const formData = new FormData();
		formData.append('file', uploadingFile.file);
		formData.append('scope', 'chat');

		const xhr = new XMLHttpRequest();
		xhr.upload.addEventListener('progress', (e) => {
			if (!e.lengthComputable) return;
			const progress = Math.round((e.loaded / e.total) * 100);
			uploadingFiles = uploadingFiles.map((uf) =>
				uf.file === uploadingFile.file ? { ...uf, progress } : uf
			);
			if (progress === 100)
				uploadingFiles = uploadingFiles.map((uf) =>
					uf.file === uploadingFile.file ? { ...uf, status: 'processing' } : uf
				);
		});
		xhr.addEventListener('load', () => {
			if (xhr.status === 200) {
				const result = JSON.parse(xhr.responseText);
				uploadingFiles = uploadingFiles.map((uf) =>
					uf.file === uploadingFile.file ? { ...uf, status: 'processing' } : uf
				);
				if (result.file?.id) registerForPolling(result.file.id, uploadingFile.file);
				else
					uploadingFiles = uploadingFiles.map((uf) =>
						uf.file === uploadingFile.file
							? { ...uf, status: 'error', error: 'Invalid response' }
							: uf
					);
			} else {
				uploadingFiles = uploadingFiles.map((uf) =>
					uf.file === uploadingFile.file ? { ...uf, status: 'error', error: 'Upload failed' } : uf
				);
			}
		});
		xhr.addEventListener('error', () => {
			uploadingFiles = uploadingFiles.map((uf) =>
				uf.file === uploadingFile.file ? { ...uf, status: 'error', error: 'Network error' } : uf
			);
		});
		xhr.open('POST', `/api/chat/threads/${threadId}/upload`);
		xhr.send(formData);
	}

	function removeFile(index: number) {
		uploadingFiles = uploadingFiles.filter((_, i) => i !== index);
	}

	function autoResize(node: HTMLTextAreaElement) {
		function resize() {
			node.style.height = 'auto';
			node.style.height = `${Math.min(node.scrollHeight, 200)}px`;
		}
		node.addEventListener('input', resize);
		// Initial resize
		setTimeout(resize, 0);
		return {
			destroy() {
				node.removeEventListener('input', resize);
			}
		};
	}

	function handleTranscription(text: string) {
		message = message ? message + ' ' + text : text;
		setTimeout(() => {
			if (textarea) {
				textarea.focus();
				textarea.style.height = 'auto';
				textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
			}
		}, 0);
	}
</script>

<div
	class={cn(
		floating
			? 'pointer-events-none absolute right-0 bottom-3 left-0 z-50 flex w-full justify-center px-3 md:bottom-6 md:px-4'
			: 'relative flex w-full justify-center'
	)}
>
	<div class={cn('pointer-events-auto flex w-full flex-col gap-3', floating ? 'max-w-3xl' : 'max-w-none')}>
		<!-- Credit Gate -->
		{#if creditsBlocked}
			<CreditGate creditBalance={creditBalance!} {hasSubscription} />
		{/if}

		<!-- File Previews (Above Input) -->
		{#if uploadingFiles.length > 0}
			<div class="flex animate-in flex-wrap gap-2 px-2 fade-in slide-in-from-bottom-2">
				{#each uploadingFiles as uf, index (uf.file)}
					<div
						class={cn(
							'group relative flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium shadow-sm backdrop-blur-md transition-all',
							uf.status === 'completed'
								? 'border-primary/30 bg-primary/5 text-primary'
								: 'border-border/50 bg-background/80 text-muted-foreground'
						)}
					>
						{#if uf.status === 'uploading' || uf.status === 'processing'}
							<Loader2 class="h-3 w-3 animate-spin" />
						{:else if uf.status === 'completed'}
							<CheckCircle class="h-3 w-3" />
						{:else}
							<X class="h-3 w-3" />
						{/if}
						<span class="max-w-30 truncate">{uf.file.name}</span>
						<button
							onclick={() => removeFile(index)}
							class="ml-1 rounded-full p-0.5 opacity-60 hover:bg-foreground/10 hover:opacity-100"
							type="button"
						>
							<X class="size-3" />
						</button>
					</div>
				{/each}
			</div>
		{/if}

		<div
			class="rounded-[28px] p-px"
			style="background: linear-gradient(90deg, rgba(162, 89, 255, 0.52) 0%, rgba(104, 117, 253, 0.44) 50%, rgba(255, 89, 180, 0.28) 100%); box-shadow: 0px 4px 40px 0px rgba(221, 194, 255, 0.72), 0px 4px 40px 0px rgba(227, 240, 255, 0.68), 0px 4px 40px 0px rgba(255, 89, 180, 0.18);"
		>
			<div
				class={cn(
					'relative flex flex-col gap-0 rounded-[27px] bg-white/96 backdrop-blur-xl transition-all duration-300',
					isFocused
						? 'shadow-[0_14px_34px_-18px_rgba(124,77,255,0.38)]'
						: 'shadow-[0_12px_28px_-18px_rgba(15,23,42,0.18)]'
				)}
			>
				<div class="flex items-start gap-3 px-4 pt-4 md:px-5 md:pt-5">
					<Search class="mt-3 size-5 shrink-0 text-slate-400" />
					<textarea
						bind:this={textarea}
						bind:value={message}
						use:autoResize
						onkeydown={handleKeydown}
						onfocus={() => (isFocused = true)}
						onblur={() => (isFocused = false)}
						{placeholder}
						disabled={disabled || isStreaming}
						class="min-h-13 flex-1 resize-none bg-transparent px-0 pt-2 pb-2 text-sm leading-relaxed text-slate-700 outline-none placeholder:text-slate-400 disabled:opacity-50 md:text-[15px]"
						rows="1"
					></textarea>

					<div class="pt-1">
						{#if isStreaming}
							<Button
								variant="secondary"
								size="icon"
								class="size-10 rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200"
								onclick={onStop}
							>
								<div class="size-2.5 rounded-sm bg-current"></div>
							</Button>
						{:else}
							<Button
								size="icon"
								class={cn(
									'size-10 rounded-2xl transition-all duration-300',
									message.trim()
										? 'bg-[#7c4dff] text-white shadow-[0_12px_30px_-14px_rgba(124,77,255,0.9)] hover:bg-[#6d42ef]'
										: 'bg-slate-200 text-slate-400'
								)}
								disabled={!message.trim() || disabled || !allFilesReady}
								onclick={handleSubmit}
							>
								{#if uploadingFiles.length > 0 && !allFilesReady}
									<Loader2 class="size-4 animate-spin" />
								{:else}
									<Send class="ml-0.5 size-4" />
								{/if}
							</Button>
						{/if}
					</div>
				</div>

				<div class="flex flex-wrap items-center justify-between gap-2 border-t border-[#eef2f6] px-2 pb-2.5 pt-2 md:px-3 md:pb-3 md:pt-2.5">
					<div class="flex flex-wrap items-center gap-0.5">
						<Tooltip.Root>
							<Tooltip.Trigger>
								{#snippet child({ props })}
									<Button
										{...props}
										variant="ghost"
										size="icon"
										class="size-9 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700"
										onclick={() => fileInput?.click()}
										disabled={disabled || isStreaming}
									>
										<Paperclip class="size-4" />
									</Button>
								{/snippet}
							</Tooltip.Trigger>
							<Tooltip.Content side="top">Attach file</Tooltip.Content>
						</Tooltip.Root>
						<input
							bind:this={fileInput}
							type="file"
							multiple
							class="hidden"
							onchange={handleFileSelect}
							accept={SUPPORTED_FILE_EXTENSIONS.join(',')}
						/>

						<VoiceRecorder
							{threadId}
							{disabled}
							{isStreaming}
							onTranscription={handleTranscription}
						/>

						{#if !hideAgentSelector}
							<div class="mx-1.5 h-4 w-px bg-[#e4e9ef]"></div>
							<AgentSelector
								{agents}
								{selectedAgentId}
								onSelectAgent={(id: string) => onAgentChange?.(id)}
							/>
						{/if}

						{#if availableModels.length > 0 || pinnedModelInfo}
							<div class="mx-1 h-4 w-px bg-[#e4e9ef]"></div>
							<ModelPicker
								models={availableModels}
								{selectedModelId}
								onModelChange={(id) => onModelChange?.(id)}
								{allowedModelIds}
								{pinnedModelInfo}
							/>
						{/if}
					</div>

					{#if !floating}
						<p class="pr-2 text-[11px] text-slate-400">
							AI can make mistakes. Verify important information.
						</p>
					{/if}
				</div>
			</div>
		</div>

		{#if floating}
			<div
				class="text-center text-[10px] text-muted-foreground/60 transition-opacity duration-500"
				class:opacity-0={isFocused}
			>
				AI can make mistakes. Please verify important information.
			</div>
		{/if}
	</div>
</div>
