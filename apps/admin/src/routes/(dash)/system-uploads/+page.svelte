<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/shadcn/button';
	import * as Card from '$lib/components/shadcn/card';
	import { renderComponent } from '$lib/components/shadcn/data-table';
	import * as Dialog from '$lib/components/shadcn/dialog';
	import { Label } from '$lib/components/shadcn/label';
	import * as Tabs from '$lib/components/shadcn/tabs';
	import DataTable from '$lib/components/table/data-table.svelte';
	import BadgeCell from '$lib/components/table/widgets/badge-cell.svelte';
	import type { AiSystemUploadRow } from '@repo/db/types';
	import type { ColumnDef } from '@tanstack/table-core';
	import { formatDistanceToNow } from 'date-fns';
	import { toast } from 'svelte-sonner';
	import { uploadSystemFiles, getSystemKnowledgeGraph } from './system-uploads.remote';
	import SystemUploadRowActions from './system-upload-row-actions.svelte';
	import SystemGraphVisualizer from './system-graph-visualizer.svelte';
	import Upload from '@lucide/svelte/icons/upload';
	import FileText from '@lucide/svelte/icons/file-text';
	import Loader2 from '@lucide/svelte/icons/loader-2';
	import X from '@lucide/svelte/icons/x';
	import Network from '@lucide/svelte/icons/network';

	let { data } = $props();

	const graphQuery = getSystemKnowledgeGraph();

	let activeTab = $state('files');
	let isUploadDialogOpen = $state(false);
	let selectedFiles = $state<File[]>([]);

	// Handle upload result
	$effect(() => {
		const result = uploadSystemFiles.result;
		if (!result) return;

		if (result.success) {
			toast.success(`Successfully uploaded ${result.successCount}/${result.totalFiles} files`);
			isUploadDialogOpen = false;
			selectedFiles = [];
			return;
		}

		const failed = (result as any)?.results?.failed as
			| Array<{ fileName: string; error: string }>
			| undefined;
		if (Array.isArray(failed) && failed.length > 0) {
			const first = failed[0];
			const detail = first?.error ? `: ${first.error}` : '';
			toast.error(`Failed to upload ${result.failedCount}/${result.totalFiles} files${detail}`);
			return;
		}

		if ('error' in (result as any)) {
			toast.error(((result as any).error as string) || 'Upload failed');
			return;
		}

		toast.error('Upload failed');
	});

	function formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	function getFileTypeLabel(mimeType: string): string {
		const typeMap: Record<string, string> = {
			'application/pdf': 'PDF',
			'text/plain': 'Text',
			'text/csv': 'CSV',
			'text/html': 'HTML',
			'image/jpeg': 'JPEG',
			'image/png': 'PNG',
			'image/webp': 'WebP',
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
			'application/vnd.ms-excel': 'XLS'
		};
		return typeMap[mimeType] || mimeType.split('/')[1]?.toUpperCase() || 'Unknown';
	}

	function getProcessingStatus(upload: AiSystemUploadRow): 'processing' | 'ready' | 'failed' {
		const vectors = (upload as any)?.vectors as string[] | undefined;
		const meta = (upload as any)?.meta as Record<string, unknown> | undefined;
		const graphNodeIds = (meta?.graphNodeIds as string[] | undefined) ?? [];

		if (meta?.processingError) return 'failed';
		const totalChunks = (meta?.totalChunks as number) ?? 0;
		const chunksCount = (meta?.chunksCount as number) ?? 0;
		if (totalChunks > 0 && chunksCount < totalChunks) return 'processing';
		if ((vectors?.length ?? 0) > 0 || graphNodeIds.length > 0) return 'ready';
		return 'processing';
	}

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			selectedFiles = Array.from(input.files);
		}
	}

	function removeFile(index: number) {
		selectedFiles = selectedFiles.filter((_, i) => i !== index);
	}

	function clearFiles() {
		selectedFiles = [];
	}

	const columns: ColumnDef<AiSystemUploadRow>[] = [
		{
			accessorKey: 'name',
			header: 'File Name',
			cell: ({ row }) => {
				return row.original.name;
			}
		},
		{
			id: 'status',
			header: 'Status',
			cell: ({ row }) => {
				const status = getProcessingStatus(row.original);
				return renderComponent(BadgeCell, {
					variant: status === 'ready' ? 'default' : status === 'failed' ? 'destructive' : 'outline',
					value: status
				});
			}
		},
		{
			accessorKey: 'description',
			header: 'Description',
			cell: ({ row }) => {
				const desc = row.original?.description;
				if (!desc) return '—';
				return desc.length > 50 ? desc.slice(0, 50) + '...' : desc;
			}
		},
		{
			accessorKey: 'type',
			header: 'Type',
			cell: ({ row }) =>
				renderComponent(BadgeCell, {
					variant: 'outline',
					value: getFileTypeLabel(row.original.type ?? '')
				})
		},
		{
			accessorKey: 'created',
			header: 'Uploaded',
			cell: ({ row }) => {
				if (!row.original.created) return '—';
				return formatDistanceToNow(new Date(row.original.created), { addSuffix: true });
			}
		},
		{
			id: 'actions',
			cell: ({ row }) =>
				renderComponent(SystemUploadRowActions, {
					row
				})
		}
	];
</script>

<div class="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
	<div class="flex items-center justify-between px-4 lg:px-6">
		<div>
			<h2 class="text-2xl font-bold tracking-tight">System Uploads</h2>
			<p class="text-muted-foreground">
				Manage system-wide files that are available to all AI agents.
			</p>
		</div>
		<div class="flex items-center space-x-2">
			<Button onclick={() => (isUploadDialogOpen = true)}>
				<Upload class="mr-2 h-4 w-4" />
				Upload Files
			</Button>
		</div>
	</div>

	<div class="px-4 lg:px-6">
		<Tabs.Root bind:value={activeTab}>
			<Tabs.List class="mb-4">
				<Tabs.Trigger value="files" class="flex items-center gap-2">
					<FileText class="h-4 w-4" />
					Files
				</Tabs.Trigger>
				<Tabs.Trigger value="graph" class="flex items-center gap-2">
					<Network class="h-4 w-4" />
					Knowledge Graph
				</Tabs.Trigger>
			</Tabs.List>

			<Tabs.Content value="files">
				<Card.Root>
					<Card.Header>
						<Card.Title class="flex items-center gap-2">
							<FileText class="h-5 w-5" />
							System Files
						</Card.Title>
						<Card.Description>
							These files are indexed and available for RAG (Retrieval Augmented Generation) across
							all agents.
						</Card.Description>
					</Card.Header>
					<Card.Content>
						<DataTable id="system_uploads_table" {columns} data={data.tableData} />
					</Card.Content>
				</Card.Root>
			</Tabs.Content>

			<Tabs.Content value="graph">
				<SystemGraphVisualizer graphData={graphQuery.current} loading={graphQuery.loading} />
			</Tabs.Content>
		</Tabs.Root>
	</div>
</div>

<Dialog.Root bind:open={isUploadDialogOpen}>
	<Dialog.Content class="sm:max-w-125">
		<Dialog.Header>
			<Dialog.Title>Upload System Files</Dialog.Title>
			<Dialog.Description>
				Upload files to be indexed and made available to all AI agents. Supported formats: PDF,
				DOCX, TXT, CSV, HTML, and images. You can select multiple files.
			</Dialog.Description>
		</Dialog.Header>

		<form
			{...uploadSystemFiles.enhance(async ({ submit }) => {
				await submit();
				invalidateAll();
			})}
			enctype="multipart/form-data"
		>
			<div class="grid gap-4 py-4">
				<div class="grid gap-2">
					<Label for="files">Select Files</Label>
					<input
						name="files[]"
						type="file"
						id="files"
						multiple
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
						accept=".pdf,.doc,.docx,.txt,.csv,.html,.jpg,.jpeg,.png,.webp,.xlsx,.xls"
						onchange={handleFileSelect}
					/>
				</div>

				{#if selectedFiles.length > 0}
					<div class="flex items-center justify-between">
						<p class="text-sm text-muted-foreground">
							{selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected ({formatFileSize(
								selectedFiles.reduce((acc, f) => acc + f.size, 0)
							)} total)
						</p>
						<Button type="button" variant="ghost" size="sm" onclick={clearFiles}>Clear all</Button>
					</div>
					<div class="max-h-50 space-y-2 overflow-y-auto rounded-md border p-2">
						{#each selectedFiles as file, index}
							<div class="flex items-center gap-2 rounded-md bg-muted/50 p-2">
								<FileText class="h-4 w-4 shrink-0 text-muted-foreground" />
								<div class="min-w-0 flex-1">
									<p class="truncate text-sm font-medium">{file.name}</p>
									<p class="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
								</div>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									class="h-6 w-6 shrink-0"
									onclick={() => removeFile(index)}
								>
									<X class="h-3 w-3" />
								</Button>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (isUploadDialogOpen = false)}
					>Cancel</Button
				>
				<Button
					type="submit"
					disabled={selectedFiles.length === 0 || !!uploadSystemFiles.pending}
					aria-busy={!!uploadSystemFiles.pending}
				>
					{#if uploadSystemFiles.pending}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						Uploading {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}...
					{:else}
						<Upload class="mr-2 h-4 w-4" />
						Upload {selectedFiles.length > 0 ? selectedFiles.length : ''} File{selectedFiles.length !==
						1
							? 's'
							: ''}
					{/if}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
