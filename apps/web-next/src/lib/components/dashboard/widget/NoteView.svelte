<script lang="ts">
	import { Pin, PinOff, Loader2 } from '@lucide/svelte';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { toggleNotePin, getNotes, type Note as KnowledgeNote } from '$lib/remote/knowledge.remote';

	type Props = {
		note: KnowledgeNote;
		onpin?: (pinned: boolean) => void;
	};

	let { note, onpin }: Props = $props();

	let pinned = $state(false);
	let pinning = $state(false);

	$effect(() => {
		pinned = note.pinned;
	});

	async function handleTogglePin() {
		if (pinning) return;

		const next = !pinned;
		pinned = next;
		pinning = true;

		try {
			await toggleNotePin({ noteId: note.id, pinned: next }).updates(getNotes());
			onpin?.(next);
		} catch {
			pinned = !next;
		} finally {
			pinning = false;
		}
	}

	function cleanMarkdown(value: string, length = 500) {
		return (value ?? '')
			.replace(/<[^>]*>/g, '')
			.replace(/^#{1,6}\s+/gm, '')
			.replace(/\*\*(.+?)\*\*/g, '$1')
			.replace(/\*(.+?)\*/g, '$1')
			.replace(/~~(.+?)~~/g, '$1')
			.replace(/`{1,3}[^`]*`{1,3}/g, '')
			.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
			.replace(/^[\s]*[-*+>]\s+/gm, '')
			.replace(/^\d+\.\s+/gm, '')
			.replace(/\n+/g, ' ')
			.replace(/\s+/g, ' ')
			.trim()
			.slice(0, length);
	}

	let title = $derived(cleanMarkdown(note.title, 100) || 'Untitled');
	let description = $derived(cleanMarkdown(note.content) || 'No note content yet.');

	let tags = $derived.by(() => {
		const result: string[] = [];
		if (note.category) result.push(note.category);
		if (note.agentName) result.push(note.agentName);
		const date = new Date(note.updated || note.created);
		if (!Number.isNaN(date.getTime())) {
			result.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
		}
		return result.length ? result : ['Add Tag'];
	});
</script>

<Card class="h-full py-6 font-Inter shadow-[0_8px_30px_rgba(0,0,0,0.04)] ring-0 backdrop-blur-xl">
	<CardHeader class="flex items-center justify-between">
		<CardTitle class="font-Inter text-3xl font-semibold text-[#83899F]">
			{title}
		</CardTitle>

		<Button
			class={pinned
				? 'size-12 rounded-full bg-amber-100 text-amber-600 shadow-sm hover:bg-amber-200'
				: 'size-12 rounded-full bg-white shadow-sm hover:bg-muted'}
			variant="secondary"
			onclick={handleTogglePin}
			disabled={pinning}
			aria-label={pinned ? 'Unpin note' : 'Pin note'}
			title={pinned ? 'Unpin' : 'Pin'}
		>
			{#if pinning}
				<Loader2 class="size-5 animate-spin" />
			{:else if pinned}
				<PinOff class="size-5" />
			{:else}
				<Pin class="size-5 rotate-45" />
			{/if}
		</Button>
	</CardHeader>

	<CardContent class="flex flex-col gap-3">
		<!-- Top badges -->
		<section class="flex flex-wrap gap-3">
			{#each tags as tag}
				<Button
					variant="secondary"
					class="
						flex
						w-fit
						gap-4
						rounded-full
						border-2
						border-dashed
						border-muted
						bg-white
						p-5
						text-lg
						font-medium
						text-muted-foreground
					"
				>
					{tag}
				</Button>
			{/each}
		</section>

		<p class="font-Inter text-lg font-normal text-[#83899F]">
			{description}
		</p>
	</CardContent>
</Card>
