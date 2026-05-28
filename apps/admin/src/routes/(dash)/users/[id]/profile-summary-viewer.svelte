<script lang="ts">
	import { Button } from '$lib/components/shadcn/button';
	import * as Card from '$lib/components/shadcn/card';
	import { Skeleton } from '$lib/components/shadcn/skeleton';
	import {
		Download,
		FileText,
		RefreshCw,
		Clock,
		CheckCircle,
		Loader2,
		AlertCircle
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { marked } from 'marked';
	import { getUserProfileSummary, refreshUserProfileSummary } from './user-details.remote';

	interface Props {
		userId: string;
		userName?: string;
	}

	let { userId, userName = 'User' }: Props = $props();

	// Query for profile summary
	const summaryQuery = getUserProfileSummary();
	const summaryData = $derived(summaryQuery.current);

	let isRefreshing = $state(false);

	// Configure marked
	marked.setOptions({
		breaks: true,
		gfm: true
	});

	const renderedContent = $derived(summaryData?.summary ? marked.parse(summaryData.summary) : '');

	async function handleRefresh() {
		isRefreshing = true;
		try {
			await refreshUserProfileSummary();
			await summaryQuery.refresh();
			toast.success('Profile summary regenerated successfully');
		} catch (err) {
			toast.error('Failed to regenerate profile summary');
			console.error(err);
		} finally {
			isRefreshing = false;
		}
	}

	function downloadAsMarkdown() {
		if (!summaryData?.summary) return;

		const blob = new Blob([summaryData.summary], { type: 'text/markdown' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${userName.replace(/\s+/g, '_')}_profile_summary.md`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		toast.success('Downloaded as Markdown');
	}

	function downloadAsText() {
		if (!summaryData?.summary) return;

		const plainText = summaryData.summary
			.replace(/#{1,6}\s/g, '')
			.replace(/\*\*([^*]+)\*\*/g, '$1')
			.replace(/\*([^*]+)\*/g, '$1')
			.replace(/`([^`]+)`/g, '$1')
			.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

		const blob = new Blob([plainText], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${userName.replace(/\s+/g, '_')}_profile_summary.txt`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		toast.success('Downloaded as Plain Text');
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<Card.Root>
	<Card.Header>
		<div class="flex items-center justify-between">
			<div>
				<Card.Title class="flex items-center gap-2">
					<FileText class="h-5 w-5" />
					Profile Summary
				</Card.Title>
				<Card.Description>AI-generated comprehensive client profile document</Card.Description>
			</div>
			<div class="flex items-center gap-2">
				{#if summaryData}
					<div class="mr-4 flex items-center gap-4 text-sm text-muted-foreground">
						{#if summaryData.fromCache}
							<span class="flex items-center gap-1">
								<CheckCircle class="h-3.5 w-3.5 text-green-500" />
								Cached
							</span>
						{/if}
						{#if summaryData.regenerating}
							<span class="flex items-center gap-1 text-amber-500">
								<Loader2 class="h-3.5 w-3.5 animate-spin" />
								Regenerating...
							</span>
						{/if}
						{#if summaryData.generatedAt}
							<span class="flex items-center gap-1">
								<Clock class="h-3.5 w-3.5" />
								{formatDate(summaryData.generatedAt)}
							</span>
						{/if}
					</div>
				{/if}
				<Button
					variant="outline"
					size="sm"
					onclick={handleRefresh}
					disabled={isRefreshing || summaryQuery.loading}
				>
					<RefreshCw class="mr-2 h-4 w-4 {isRefreshing ? 'animate-spin' : ''}" />
					{isRefreshing ? 'Regenerating...' : 'Regenerate'}
				</Button>
				<Button
					variant="default"
					size="sm"
					disabled={!summaryData?.summary || summaryQuery.loading}
					onclick={downloadAsMarkdown}
				>
					<Download class="mr-2 h-4 w-4" />
					Download
				</Button>
			</div>
		</div>
	</Card.Header>
	<Card.Content>
		{#if summaryQuery.loading}
			<div class="space-y-4">
				<Skeleton class="h-8 w-3/4" />
				<Skeleton class="h-4 w-full" />
				<Skeleton class="h-4 w-full" />
				<Skeleton class="h-4 w-2/3" />
				<div class="pt-4">
					<Skeleton class="h-6 w-1/2" />
					<Skeleton class="mt-2 h-4 w-full" />
					<Skeleton class="mt-1 h-4 w-full" />
					<Skeleton class="mt-1 h-4 w-4/5" />
				</div>
				<div class="pt-4">
					<Skeleton class="h-6 w-1/3" />
					<Skeleton class="mt-2 h-4 w-full" />
					<Skeleton class="mt-1 h-4 w-3/4" />
				</div>
			</div>
		{:else if summaryQuery.error}
			<div class="flex flex-col items-center justify-center py-12 text-center">
				<AlertCircle class="mb-3 h-10 w-10 text-destructive/50" />
				<p class="text-sm font-medium text-destructive">Failed to load profile summary</p>
				<p class="mt-1 text-xs text-muted-foreground">{summaryQuery.error.message}</p>
				<Button variant="outline" size="sm" class="mt-4" onclick={handleRefresh}>Try Again</Button>
			</div>
		{:else if summaryData?.summary}
			<div class="relative">
				<!-- Download options -->
				<div class="absolute top-0 right-0 flex gap-1">
					<Button
						variant="ghost"
						size="sm"
						onclick={downloadAsMarkdown}
						title="Download as Markdown"
					>
						<span class="font-mono text-xs">.md</span>
					</Button>
					<Button variant="ghost" size="sm" onclick={downloadAsText} title="Download as Plain Text">
						<span class="font-mono text-xs">.txt</span>
					</Button>
					<!-- <Button variant="ghost" size="sm" onclick={downloadAsHtml} title="Download as HTML">
						<span class="font-mono text-xs">.html</span>
					</Button> -->
				</div>

				<!-- Rendered markdown content -->
				<article class="prose prose-sm max-w-none pt-8 dark:prose-invert">
					{@html renderedContent}
				</article>
			</div>
		{:else}
			<div class="flex flex-col items-center justify-center py-12 text-center">
				<FileText class="mb-3 h-10 w-10 text-muted-foreground/30" />
				<p class="text-sm text-muted-foreground">No profile summary available</p>
				<Button variant="outline" size="sm" class="mt-4" onclick={handleRefresh}>
					Generate Summary
				</Button>
			</div>
		{/if}
	</Card.Content>
</Card.Root>
