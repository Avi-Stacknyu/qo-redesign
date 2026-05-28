<script lang="ts">
	import { EllipsisVertical, ListFilter } from '@lucide/svelte';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import Search from '$lib/components/Search.svelte';

	type Note = {
		id: number;
		title: string;
		description: string;

		date?: string;
		category?: string;
	};

	type Props = {
		title?: string;
		notes: Note[];
		selectedNoteId?: number | null;
		onSelect?: (note: Note) => void;

		showSearch?: boolean;
		showFilter?: boolean;
		showMenu?: boolean;

		showDate?: boolean;
		showCategory?: boolean;
	};

	let {
		title = 'Recent Notes',
		notes,
		selectedNoteId = null,
		onSelect,

		showSearch = true,
		showFilter = true,
		showMenu = true,

		showDate = true,
		showCategory = true
	}: Props = $props();
</script>

<main class="min-h-0">
	<Card
		class="flex max-h-[calc(100vh-4rem)] w-full ring-0 flex-col overflow-hidden border-0 bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)] backdrop-blur-xl"
	>
		<CardContent class="flex min-h-0 flex-1 flex-col gap-5 p-1">
			<!-- Header -->
			<div class="flex flex-col gap-4">
				<div class="flex items-center justify-between">
					<h1 class="text-2xl font-bold tracking-tight text-primary">
						{title}
					</h1>

					{#if showFilter}
						<Button
							variant="outline"
							class="
								rounded-full
								border-muted
								bg-white
								px-4
                                py-4
								text-base
								font-medium
								text-muted-foreground
								shadow-2xs
								hover:bg-gray-200
							"
						>
							Filter
							<ListFilter class="ml-2 h-4 w-4" />
						</Button>
					{/if}
				</div>

				{#if showSearch}
					<Search />
				{/if}
			</div>

			<!-- Notes -->
			<div class="notes-scroll min-h-0 flex-1 overflow-y-auto px-1 py-1 scrollbar-hide">
				<div class="flex flex-col gap-4 pb-1">
					{#each notes as note (note.id)}
						<Card
							class="p-0 shadow-none transition-colors border-0 ring-[#F6F6F6]"
							role={onSelect ? 'button' : undefined}
							tabindex={onSelect ? 0 : undefined}
							aria-pressed={onSelect ? selectedNoteId === note.id : undefined}
							onclick={() => onSelect?.(note)}
							onkeydown={(event) => {
								if (!onSelect) return;

								if (event.key === 'Enter' || event.key === ' ') {
									event.preventDefault();
									onSelect(note);
								}
							}}
						>
							<CardContent class="relative flex flex-col gap-4 p-4">
								<!-- Top Tags -->
								{#if showDate || showCategory}
									<div class="flex items-center gap-3">
										{#if showDate && note.date}
											<span
												class="
													rounded-full
													bg-muted
													px-3
													py-1
													text-xs
													font-semibold
													text-muted-foreground
												"
											>
												{note.date}
											</span>
										{/if}

										{#if showCategory && note.category}
											<span
												class="
													rounded-full
													bg-white
													px-3
													py-1
													text-xs
													font-medium
													text-muted-foreground
												"
											>
												{note.category}
											</span>
										{/if}
									</div>
								{/if}

								<!-- Content -->
								<div class="flex flex-col gap-4">
									<h2 class="text-lg font-semibold text-primary">
										{note.title}
									</h2>

									<p class="text-base font-normal font-Inter leading-6 text-[#83899F]">
										{note.description}
									</p>
								</div>

								<!-- Menu -->
								{#if showMenu}
									<Button
										size="icon"
										variant="ghost"
										class="
											absolute
											right-3
											top-3
											h-9
											w-9
											cursor-pointer
											rounded-full
											text-muted-foreground
											hover:bg-gray-100
										"
									>
										<EllipsisVertical class="h-4 w-4" />
									</Button>
								{/if}
							</CardContent>
						</Card>
					{/each}
				</div>
			</div>
		</CardContent>
	</Card>
</main>