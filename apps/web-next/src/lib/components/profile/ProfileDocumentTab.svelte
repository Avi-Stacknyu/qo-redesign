<script lang="ts">
	import { Download, Loader2, Copy, Check, FileText, Sparkles } from '@lucide/svelte';
	import { Button } from '$lib/components/shadcn/button/index.js';
	import { toast } from 'svelte-sonner';
	import { buildProfileRefreshKey } from '$lib/data/profile-refresh';
	import { shouldIgnoreProfileRequestError } from '$lib/data/profile-ui';
	import { downloadProfileMarkdown, loadProfileSummary } from '$lib/remote/profile-data.remote';
	import type { ProfileData } from '$lib/data/profile-types';
	import { marked } from 'marked';

	let {
		profile,
		isActive = false
	}: {
		profile: ProfileData;
		isActive?: boolean;
	} = $props();

	let isCopied = $state(false);
	let activeView = $state<'summary' | 'raw'>('summary');

	// Raw markdown
	let markdown = $state<string | null>(null);
	let isLoadingRaw = $state(false);
	let lastRawKey = $state<string | null>(null);

	// AI summary
	let summaryHtml = $state<string | null>(null);
	let summaryRaw = $state<string | null>(null);
	let isLoadingSummary = $state(false);
	let summaryGeneratedAt = $state<string | null>(null);
	let lastSummaryKey = $state<string | null>(null);
	let pendingRawKey: string | null = null;
	let pendingSummaryKey: string | null = null;
	let rawRequestId = 0;
	let summaryRequestId = 0;

	let refreshKey = $derived(buildProfileRefreshKey(profile));

	marked.setOptions({ breaks: true, gfm: true });

	async function loadRaw(force = false) {
		const nextKey = refreshKey;
		if (!force && markdown !== null && lastRawKey === nextKey) return;
		if (pendingRawKey === nextKey) return;
		const requestId = ++rawRequestId;
		pendingRawKey = nextKey;
		isLoadingRaw = true;
		try {
			const nextMarkdown = await downloadProfileMarkdown();
			if (requestId !== rawRequestId) return;
			markdown = nextMarkdown;
			lastRawKey = nextKey;
		} catch (error) {
			if (requestId !== rawRequestId) return;
			if (!shouldIgnoreProfileRequestError(error)) {
				toast.error('Failed to load raw profile data');
			}
		} finally {
			if (requestId === rawRequestId) {
				pendingRawKey = null;
				isLoadingRaw = false;
			}
		}
	}

	async function loadSummary(force = false) {
		const nextKey = refreshKey;
		if (!force && summaryHtml !== null && lastSummaryKey === nextKey) return;
		if (pendingSummaryKey === nextKey) return;
		const requestId = ++summaryRequestId;
		pendingSummaryKey = nextKey;
		isLoadingSummary = true;
		try {
			const result = await loadProfileSummary();
			if (requestId !== summaryRequestId) return;
			if (result?.summary) {
				summaryRaw = result.summary;
				summaryHtml = String(marked(result.summary));
				summaryGeneratedAt = result.generatedAt;
				lastSummaryKey = nextKey;
			}
		} catch (error) {
			if (requestId !== summaryRequestId) return;
			if (!shouldIgnoreProfileRequestError(error)) {
				// toast.error('Failed to load profile summary');
			}
		} finally {
			if (requestId === summaryRequestId) {
				pendingSummaryKey = null;
				isLoadingSummary = false;
			}
		}
	}

	$effect(() => {
		if (isActive && profile.sections.length > 0) {
			if (activeView === 'summary') void loadSummary(lastSummaryKey !== refreshKey);
			else void loadRaw(lastRawKey !== refreshKey);
		}
	});

	async function handleCopy() {
		const content = activeView === 'summary' ? summaryRaw : markdown;
		if (!content) return;
		await navigator.clipboard.writeText(content);
		isCopied = true;
		toast.success('Copied to clipboard');
		setTimeout(() => (isCopied = false), 2000);
	}

	async function handleDownload() {
		const content = activeView === 'summary' ? summaryRaw : markdown;
		if (!content) return;
		const filename = activeView === 'summary' ? 'Profile-Summary.md' : 'Profile-Raw.md';
		const blob = new Blob([content], { type: 'text/markdown' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
		toast.success('Downloaded');
	}

	let isLoading = $derived(activeView === 'summary' ? isLoadingSummary : isLoadingRaw);
	let hasContent = $derived(activeView === 'summary' ? !!summaryHtml : !!markdown);
</script>

{#if profile.sections.length === 0}
	<div class="rounded-lg border border-border/30 bg-card/40 py-10 text-center backdrop-blur">
		<p class="text-sm text-muted-foreground">No profile data to document yet.</p>
	</div>
{:else}
	<div class="space-y-4">
		<!-- Toggle + Actions -->
		<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div class="flex gap-1 rounded-lg border border-border/30 bg-card/30 p-0.5">
				<button
					class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors {activeView ===
					'summary'
						? 'bg-primary text-primary-foreground'
						: 'text-muted-foreground hover:text-foreground'}"
					onclick={() => {
						activeView = 'summary';
						void loadSummary(lastSummaryKey !== refreshKey);
					}}
				>
					<Sparkles class="size-3" />
					Summary
				</button>
				<button
					class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors {activeView ===
					'raw'
						? 'bg-primary text-primary-foreground'
						: 'text-muted-foreground hover:text-foreground'}"
					onclick={() => {
						activeView = 'raw';
						void loadRaw(lastRawKey !== refreshKey);
					}}
				>
					<FileText class="size-3" />
					Raw Data
				</button>
			</div>

			{#if hasContent}
				<div class="flex items-center gap-2">
					<Button variant="outline" size="sm" class="gap-1.5 text-xs" onclick={handleCopy}>
						{#if isCopied}
							<Check class="size-3.5" />
							Copied
						{:else}
							<Copy class="size-3.5" />
							Copy
						{/if}
					</Button>
					<Button variant="outline" size="sm" class="gap-1.5 text-xs" onclick={handleDownload}>
						<Download class="size-3.5" />
						Download
					</Button>
				</div>
			{/if}
		</div>

		<!-- Content -->
		{#if isLoading}
			<div class="flex items-center justify-center py-10">
				<Loader2 class="size-5 animate-spin text-muted-foreground" />
			</div>
		{:else if activeView === 'summary'}
			{#if summaryHtml}
				{#if summaryGeneratedAt}
					<p class="text-[11px] text-muted-foreground">
						Generated {new Date(summaryGeneratedAt).toLocaleDateString('en-US', {
							month: 'short',
							day: 'numeric',
							year: 'numeric'
						})}
					</p>
				{/if}
				<article
					class="prose prose-sm max-w-none rounded-lg border border-border/30 bg-card/40 p-5 backdrop-blur dark:prose-invert"
				>
					{@html summaryHtml}
				</article>
			{:else}
				<div class="rounded-lg border border-border/30 bg-card/40 py-10 text-center backdrop-blur">
					<Sparkles class="mx-auto mb-2 size-6 text-muted-foreground/40" />
					<p class="text-sm text-muted-foreground">No summary available yet.</p>
					<p class="mt-1 text-xs text-muted-foreground/60">
						Keep chatting to build your profile — a summary will be generated automatically.
					</p>
				</div>
			{/if}
		{:else if markdown}
			{@const rawHtml = String(marked(markdown))}
			<article
				class="prose prose-sm max-w-none overflow-x-auto rounded-lg border border-border/30 bg-card/40 p-5 backdrop-blur dark:prose-invert"
			>
				{@html rawHtml}
			</article>
		{:else}
			<div class="rounded-lg border border-border/30 bg-card/40 py-10 text-center backdrop-blur">
				<p class="text-sm text-muted-foreground">No raw data available.</p>
			</div>
		{/if}
	</div>
{/if}
