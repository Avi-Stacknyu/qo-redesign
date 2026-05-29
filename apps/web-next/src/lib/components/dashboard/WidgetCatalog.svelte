<script lang="ts">
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import type { WidgetSize } from '$lib/types/widgets';
	import type { DashboardWidgetRow } from '@repo/db/types';
	import { Search, Plus, ArrowLeft, Loader2 } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { getContext } from 'svelte';

	let {
		open = $bindable(false),
		onAdd
	}: {
		open?: boolean;
		onAdd: (widgetType: string, title: string, size: WidgetSize, category?: string) => void;
	} = $props();

	// DB-driven catalog via context
	const widgetCatalog = getContext<{
		map: Map<string, DashboardWidgetRow>;
		list: DashboardWidgetRow[];
		loading?: boolean;
	}>('widgetCatalog');

	let searchQuery = $state('');
	let todoPrompt = $state(false);
	let todoCategory = $state('');

	// Filter widgets based on search
	let filteredWidgets = $derived(
		(widgetCatalog?.list ?? []).filter((w) => {
			return (
				(w.name ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
				w.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
				(w.widgetType ?? '').toLowerCase().includes(searchQuery.toLowerCase())
			);
		})
	);

	function handleSelect(widget: DashboardWidgetRow) {
		if (widget.widgetType === 'todo') {
			todoPrompt = true;
			todoCategory = '';
			return;
		}
		onAdd(widget.widgetType ?? '', widget.name ?? '', (widget.defaultSize || 'md') as WidgetSize);
		open = false;
	}

	function handleTodoConfirm() {
		const label = todoCategory.trim() || 'To-Do';
		const todoWidget = widgetCatalog?.map.get('todo');
		onAdd(
			'todo',
			label,
			(todoWidget?.defaultSize || 'md') as WidgetSize,
			todoCategory.trim() || undefined
		);
		todoPrompt = false;
		todoCategory = '';
		open = false;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content
		class="flex max-h-[90dvh] flex-col gap-0 overflow-hidden border-border/40 bg-background/95 p-0 shadow-2xl backdrop-blur-xl sm:rounded-2xl sm:max-w-4xl!"
	>
		{#if todoPrompt}
			<!-- Todo Category Prompt -->
			<div class="flex flex-col gap-4 p-4 sm:p-6">
				<Dialog.Header>
					<Dialog.Title class="text-xl font-semibold tracking-tight">Name your list</Dialog.Title>
					<Dialog.Description class="text-muted-foreground">
						Give this to-do list a category name (e.g. "Work", "Personal", "Shopping").
					</Dialog.Description>
				</Dialog.Header>
				<form
					class="flex flex-col gap-4"
					onsubmit={(e) => {
						e.preventDefault();
						handleTodoConfirm();
					}}
				>
					<Input
						placeholder="List name (optional)"
						class="h-10 border-border/40 bg-muted/30"
						bind:value={todoCategory}
						autofocus
					/>
					<div class="flex justify-end gap-2">
						<Button variant="ghost" onclick={() => (todoPrompt = false)}>
							<ArrowLeft class="mr-1 size-3.5" />
							Back
						</Button>
						<Button type="submit">Create List</Button>
					</div>
				</form>
			</div>
		{:else}
			<!-- Header with Search -->
			<div class="flex shrink-0 flex-col gap-3 border-b border-border/40 p-4 sm:gap-4 sm:p-6">
				<Dialog.Header>
					<Dialog.Title class="text-lg font-semibold tracking-tight sm:text-xl">Widget Library</Dialog.Title>
					<Dialog.Description class="hidden text-muted-foreground sm:block">
						Customize your dashboard with specialized widgets.
					</Dialog.Description>
				</Dialog.Header>
				<div class="relative">
					<Search class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Search widgets..."
						class="h-10 border-border/40 bg-muted/30 pl-9 transition-all focus:bg-background focus:ring-1 focus:ring-primary/20"
						bind:value={searchQuery}
					/>
				</div>
			</div>

			<!-- Scrollable Grid Area -->
			<div class="flex-1 overflow-y-auto bg-muted/5 p-3 sm:p-6">
				<div class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
					{#each filteredWidgets as widget (widget.id)}
						<button
							aria-label={`Add ${widget.name ?? widget.widgetType ?? 'widget'}`}
							class="group relative flex flex-col overflow-hidden rounded-xl border border-border/40 bg-background text-left transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
							onclick={() => handleSelect(widget)}
						>
							<!-- Mini-Window Schematic Preview -->
							<div
								class="relative aspect-video w-full overflow-hidden border-b border-border/30 bg-muted/20"
							>
								<!-- Abstract UI Representation based on type -->
								<div
									class="absolute inset-0 flex flex-col gap-2 p-4 opacity-50 transition-opacity group-hover:opacity-80"
								>
									<!-- Header Bar -->
									<div class="h-2 w-1/3 rounded-full bg-muted-foreground/20"></div>
									<!-- Content Placeholder -->
									<div
										class="flex flex-1 gap-2 rounded-md border border-dashed border-border/40 bg-background/50 p-2"
									>
										{#if (widget.widgetType ?? '').includes('chart') || (widget.widgetType ?? '').includes('analytics')}
											<!-- Chart-like bars -->
											<div class="flex h-full w-full items-end justify-around gap-1 pt-2">
												<div class="h-[40%] w-1/5 rounded-t-sm bg-primary/20"></div>
												<div class="h-[70%] w-1/5 rounded-t-sm bg-primary/30"></div>
												<div class="h-[50%] w-1/5 rounded-t-sm bg-primary/20"></div>
												<div class="h-[80%] w-1/5 rounded-t-sm bg-primary/40"></div>
											</div>
										{:else if (widget.widgetType ?? '').includes('list') || (widget.widgetType ?? '').includes('todo')}
											<!-- List lines -->
											<div class="flex w-full flex-col gap-1.5">
												<div class="h-1.5 w-full rounded-full bg-muted-foreground/10"></div>
												<div class="h-1.5 w-3/4 rounded-full bg-muted-foreground/10"></div>
												<div class="h-1.5 w-5/6 rounded-full bg-muted-foreground/10"></div>
											</div>
										{:else}
											<!-- Generic blocks -->
											<div class="grid h-full w-full grid-cols-2 gap-2">
												<div class="rounded-sm bg-muted-foreground/10"></div>
												<div class="rounded-sm bg-muted-foreground/10"></div>
												<div class="rounded-sm bg-muted-foreground/10"></div>
												<div class="rounded-sm bg-muted-foreground/10"></div>
											</div>
										{/if}
									</div>
								</div>

								<!-- Add Overlay -->
								<div
									class="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-primary/5"
								>
									<div
										class="scale-90 opacity-0 transition-all duration-300 group-hover:scale-100 group-hover:opacity-100"
									>
										<div class="rounded-full bg-primary/10 p-2 text-primary">
											<Plus class="size-5" />
										</div>
									</div>
								</div>
							</div>

							<!-- Card Footer: Title & Description -->
							<div class="flex flex-col gap-1 p-4">
								<div class="flex items-center justify-between gap-3">
									<h3
										class="font-medium tracking-tight text-foreground transition-colors group-hover:text-primary"
									>
										{widget.name}
									</h3>
									<span
										class="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground"
									>
										<Plus class="size-3" />
										Add
									</span>
								</div>
								<p class="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
									{widget.description ||
										`Add a ${(widget.name ?? '').toLowerCase()} widget to your dashboard to track key metrics and data points.`}
								</p>
							</div>
						</button>
					{/each}
				</div>

				{#if filteredWidgets.length === 0}
					<div
						class="flex h-40 flex-col items-center justify-center gap-2 text-center text-muted-foreground"
					>
						{#if widgetCatalog?.loading && !searchQuery.trim()}
							<div class="rounded-full bg-muted p-3">
								<Loader2 class="size-6 animate-spin opacity-60" />
							</div>
							<p>Loading widgets...</p>
						{:else}
							<div class="rounded-full bg-muted p-3">
								<Search class="size-6 opacity-50" />
							</div>
							<p>No widgets found for "{searchQuery}"</p>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>
