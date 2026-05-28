<script lang="ts">
	import {
		FileText,
		File as FileIcon,
		Image,
		FileSpreadsheet,
		Download,
		Trash2,
		Loader2,
		FileArchive,
		AlertCircle
	} from '@lucide/svelte';
	import * as Card from '$lib/components/shadcn/card/index.js';
	import { Badge } from '$lib/components/shadcn/badge/index.js';
	import { Button } from '$lib/components/shadcn/button/index.js';
	import * as Table from '$lib/components/shadcn/table/index.js';
	import { toast } from 'svelte-sonner';
	import { deleteUserFile } from '$lib/remote/memory.remote';
	import type { UserFile } from '$lib/remote/memory.remote';

	let {
		files,
		totalItems
	}: {
		files: UserFile[];
		totalItems: number;
	} = $props();

	let deletingId = $state<string | null>(null);

	function fileIcon(type: string) {
		if (type.startsWith('image/')) return Image;
		if (type.includes('spreadsheet') || type.includes('csv') || type.includes('excel'))
			return FileSpreadsheet;
		if (type.includes('pdf') || type.includes('text')) return FileText;
		if (type.includes('zip') || type.includes('archive') || type.includes('compressed'))
			return FileArchive;
		return FileIcon;
	}

	function formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function fileExtension(name: string): string {
		const parts = name.split('.');
		return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : '—';
	}

	async function handleDelete(file: UserFile) {
		deletingId = file.id;
		try {
			await deleteUserFile({ fileId: file.id });
			toast.success(`Deleted ${file.name}`);
		} catch {
			toast.error(`Failed to delete ${file.name}`);
		} finally {
			deletingId = null;
		}
	}
</script>

<section class="space-y-4" aria-label="Uploaded Files">
	<div class="flex items-center justify-between gap-4">
		<div class="space-y-1">
			<h2 class="text-xl font-semibold tracking-tight text-foreground">Uploaded Files</h2>
			<p class="text-sm text-muted-foreground">
				{totalItems} file{totalItems !== 1 ? 's' : ''} in your knowledge base.
			</p>
		</div>
	</div>

	{#if files.length === 0}
		<Card.Root
			class="overflow-hidden rounded-xl border-border/40 bg-card/90 shadow-lg backdrop-blur"
		>
			<Card.Content class="flex flex-col items-center justify-center gap-3 p-12">
				<FileIcon class="size-8 text-muted-foreground/30" />
				<p class="text-sm text-muted-foreground">No files uploaded yet.</p>
				<p class="text-xs text-muted-foreground/60">
					Upload files through the chat to build your knowledge base.
				</p>
			</Card.Content>
		</Card.Root>
	{:else}
		<!-- Mobile cards -->
		<div class="space-y-2 md:hidden" role="list">
			{#each files as file (file.id)}
				{@const Icon = fileIcon(file.type)}
				<div
					class="flex items-center gap-2.5 rounded-lg border border-border/30 bg-card/60 px-3 py-2.5 backdrop-blur"
					role="listitem"
				>
					<div class="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/40">
						<Icon class="size-3.5 text-muted-foreground" />
					</div>
					<div class="min-w-0 flex-1">
						<p class="truncate text-[13px] font-medium text-foreground">{file.name}</p>
						<p class="text-[10px] text-muted-foreground">
							{fileExtension(file.name)} &middot; {formatSize(file.size)} &middot; {formatDate(
								file.createdAt
							)}
						</p>
					</div>
					<div class="flex shrink-0 items-center gap-0.5">
						<Button
							variant="ghost"
							size="icon"
							class="size-7 text-muted-foreground hover:text-foreground"
							onclick={() => window.open(`/api/files/${file.id}/download`, '_blank')}
							aria-label="Download {file.name}"
						>
							<Download class="size-3.5" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							class="size-7 text-destructive/60 hover:text-destructive"
							onclick={() => handleDelete(file)}
							disabled={deletingId === file.id}
							aria-label="Delete {file.name}"
						>
							{#if deletingId === file.id}
								<Loader2 class="size-3.5 animate-spin" />
							{:else}
								<Trash2 class="size-3.5" />
							{/if}
						</Button>
					</div>
				</div>
			{/each}
		</div>

		<!-- Desktop table -->
		<Card.Root
			class="hidden overflow-hidden rounded-xl border-border/40 bg-card/90 shadow-lg backdrop-blur md:block"
		>
			<Table.Root>
				<Table.Header>
					<Table.Row class="border-border/30 hover:bg-transparent">
						<Table.Head
							class="w-[40%] text-xs font-semibold tracking-wide text-muted-foreground uppercase"
							>Name</Table.Head
						>
						<Table.Head class="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
							>Type</Table.Head
						>
						<Table.Head class="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
							>Size</Table.Head
						>
						<Table.Head class="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
							>Date</Table.Head
						>
						<Table.Head
							class="w-20 text-right text-xs font-semibold tracking-wide text-muted-foreground uppercase"
							>Actions</Table.Head
						>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each files as file (file.id)}
						{@const Icon = fileIcon(file.type)}
						<Table.Row class="border-border/20 transition-colors hover:bg-accent/20">
							<Table.Cell class="py-3">
								<div class="flex items-center gap-3">
									<Icon class="size-4 shrink-0 text-muted-foreground/60" />
									<span class="truncate text-sm text-foreground">{file.name}</span>
								</div>
							</Table.Cell>
							<Table.Cell>
								<Badge variant="outline" class="text-[10px]">{fileExtension(file.name)}</Badge>
							</Table.Cell>
							<Table.Cell class="text-sm text-muted-foreground">{formatSize(file.size)}</Table.Cell>
							<Table.Cell class="text-sm text-muted-foreground"
								>{formatDate(file.createdAt)}</Table.Cell
							>
							<Table.Cell class="text-right">
								<div class="inline-flex items-center gap-1">
									<Button
										variant="ghost"
										size="icon"
										class="size-7 text-muted-foreground hover:text-foreground"
										onclick={() => window.open(`/api/files/${file.id}/download`, '_blank')}
										aria-label="Download {file.name}"
									>
										<Download class="size-3" />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										class="size-7 text-destructive/70 hover:text-destructive"
										onclick={() => handleDelete(file)}
										disabled={deletingId === file.id}
										aria-label="Delete {file.name}"
									>
										{#if deletingId === file.id}
											<Loader2 class="size-3 animate-spin" />
										{:else}
											<Trash2 class="size-3" />
										{/if}
									</Button>
								</div>
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Card.Root>
	{/if}
</section>
