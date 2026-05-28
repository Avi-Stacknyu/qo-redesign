<script lang="ts">
	import { marked } from 'marked';
	import { cn } from '$lib/utils';
	import { User, Paperclip, Bookmark, BookmarkCheck, Loader2 } from '@lucide/svelte';
	import AgentAvatar from '$lib/components/AgentAvatar.svelte';
	import QIcon from '$lib/components/icons/QIcon.svelte';
	import { MessagePartsRenderer } from '@repo/shared/components';
	import type { MessagePart, ChatFileAttachment } from '@repo/shared/types';
	import { formatFileSize } from '@repo/shared/utils';
	import { onMount } from 'svelte';

	let {
		role,
		content,
		timestamp,
		files,
		parts,
		agent,
		onConfirmationRespond,
		onInputSubmit,
		onSaveAsNote,
		isSaved = false
	}: {
		role: 'user' | 'assistant';
		content: string;
		timestamp?: string;
		files?: ChatFileAttachment[];
		parts?: MessagePart[];
		agent?: { id: string; name: string; avatar_url?: string | null };
		onConfirmationRespond?: (confirmed: boolean, toolCallId: string) => void;
		onInputSubmit?: (value: string, toolCallId: string) => void;
		onSaveAsNote?: (content: string) => void;
		isSaved?: boolean;
	} = $props();

	let isSaving = $state(false);
	let bubbleEl: HTMLDivElement | undefined = $state();
	let selectionPopup = $state<{ x: number; y: number; text: string } | null>(null);

	async function handleSaveAsNote() {
		if (isSaving || isSaved || !onSaveAsNote) return;
		isSaving = true;
		try {
			onSaveAsNote(content);
		} finally {
			setTimeout(() => {
				isSaving = false;
			}, 3000);
		}
	}

	async function handleSaveSelection() {
		if (!selectionPopup || !onSaveAsNote || isSaving) return;
		isSaving = true;
		try {
			onSaveAsNote(selectionPopup.text);
		} finally {
			selectionPopup = null;
			setTimeout(() => {
				isSaving = false;
			}, 3000);
		}
	}

	function handleMouseUp() {
		if (role !== 'user' && onSaveAsNote && !isSaved) {
			const selection = window.getSelection();
			const selectedText = selection?.toString().trim();
			if (selectedText && selectedText.length > 10 && bubbleEl) {
				const range = selection!.getRangeAt(0);
				const rect = range.getBoundingClientRect();
				const containerRect = bubbleEl.getBoundingClientRect();
				selectionPopup = {
					x: rect.left - containerRect.left + rect.width / 2,
					y: rect.top - containerRect.top - 8,
					text: selectedText
				};
			} else {
				selectionPopup = null;
			}
		}
	}

	function handleMouseDown() {
		selectionPopup = null;
	}

	onMount(() => {
		function onDocClick(e: MouseEvent) {
			if (selectionPopup && bubbleEl && !bubbleEl.contains(e.target as Node)) {
				selectionPopup = null;
			}
		}
		document.addEventListener('mousedown', onDocClick);
		return () => document.removeEventListener('mousedown', onDocClick);
	});

	marked.setOptions({ breaks: true, gfm: true });

	const renderedContent = $derived(marked(content));
	const hasGenerativeUIParts = $derived(parts && parts.length > 0);
	const hasContent = $derived(content && content.trim().length > 0);
	const partsIncludeText = $derived(parts?.some((p) => p.type === 'text') ?? false);
</script>

{#if role === 'user' || hasContent || hasGenerativeUIParts}
	<div class="w-full px-2 py-1.5 md:px-4 md:py-2">
		<div class="mx-auto max-w-4xl">
			<div class={cn('flex gap-2 md:gap-3', role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
				{#if role === 'assistant' && agent}
					<AgentAvatar {agent} size="chat" />
				{:else}
					<div
						class={cn(
							'flex size-6 shrink-0 items-center justify-center rounded-full md:size-8',
							role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'
						)}
					>
						{#if role === 'user'}
							<User class="size-3 md:size-4" />
						{:else}
							<QIcon class="size-4 md:size-5" />
						{/if}
					</div>
				{/if}

				<div
					class={cn(
						'group relative flex flex-col gap-1',
						role === 'user'
							? 'max-w-[85%] items-end md:max-w-[75%]'
							: 'max-w-[90%] items-start md:max-w-[85%]',
						role === 'assistant' && hasGenerativeUIParts && 'w-full sm:w-auto sm:min-w-md'
					)}
				>
					<!-- File attachments -->
					{#if files && files.length > 0}
						<div
							class={cn('flex flex-wrap gap-2', role === 'user' ? 'justify-end' : 'justify-start')}
						>
							{#each files as file}
								<div
									class="inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-sm"
								>
									<Paperclip class="h-3.5 w-3.5 text-muted-foreground" />
									<span class="max-w-32 truncate">{file.name}</span>
									<span class="text-xs text-muted-foreground">({formatFileSize(file.size)})</span>
								</div>
							{/each}
						</div>
					{/if}

					<!-- Generative UI parts -->
					{#if hasGenerativeUIParts}
						<div class="w-full">
							<MessagePartsRenderer parts={parts!} {onConfirmationRespond} {onInputSubmit} />
						</div>
					{/if}

					{#if hasContent && !partsIncludeText}
						<div
							bind:this={bubbleEl}
							class={cn(
								'relative rounded-2xl px-3 py-2 md:px-4 md:py-2.5',
								role === 'user'
									? 'rounded-br-md bg-primary text-primary-foreground'
									: 'rounded-bl-md border border-border/60 bg-muted text-foreground shadow-sm'
							)}
							onmouseup={handleMouseUp}
							onmousedown={handleMouseDown}
							role="presentation"
						>
							<div
								class={cn(
									'prose max-w-none text-[13px] leading-relaxed md:prose-sm md:text-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&>p]:m-0 [&>p]:leading-relaxed',
									role === 'user'
										? '**:text-primary-foreground prose-a:underline'
										: 'prose-a:font-medium prose-code:rounded prose-code:bg-background/80 prose-code:px-1 prose-code:py-0.5 prose-code:before:content-none prose-code:after:content-none prose-pre:bg-background prose-hr:hidden'
								)}
							>
								{@html renderedContent}
							</div>

							{#if selectionPopup}
								<button
									class="absolute z-20 -translate-x-1/2 -translate-y-full animate-in rounded-lg border border-border/50 bg-popover px-3 py-1.5 text-xs font-medium text-popover-foreground shadow-lg transition-all fade-in slide-in-from-bottom-1 hover:bg-accent"
									style="left: {selectionPopup.x}px; top: {selectionPopup.y}px;"
									onmousedown={(e) => e.stopPropagation()}
									onclick={handleSaveSelection}
								>
									<span class="flex items-center gap-1.5">
										<Bookmark class="h-3 w-3" />
										Save selection as note
									</span>
								</button>
							{/if}
						</div>
					{/if}

					{#if role === 'assistant' && onSaveAsNote && hasContent}
						<div
							class="flex items-center gap-1 pt-0.5 opacity-0 transition-opacity group-hover:opacity-100"
							class:opacity-100={isSaved || isSaving}
						>
							{#if isSaved}
								<span
									class="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-primary"
								>
									<BookmarkCheck class="h-3 w-3" /> Saved
								</span>
							{:else if isSaving}
								<span
									class="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground"
								>
									<Loader2 class="h-3 w-3 animate-spin" /> Saving...
								</span>
							{:else}
								<button
									class="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground transition hover:bg-muted hover:text-foreground"
									title="Save to Knowledge Base"
									onclick={handleSaveAsNote}
								>
									<Bookmark class="h-3 w-3" /> Save as note
								</button>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
