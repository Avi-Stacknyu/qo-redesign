<script lang="ts">
	import * as AlertDialog from '$lib/components/shadcn/alert-dialog/index.js';
	import { Button } from '$lib/components/shadcn/button/index.js';
	import { Brain, Trash2 } from '@lucide/svelte';

	let {
		open = $bindable(false),
		chatId,
		chatTitle,
		onDeleteChatOnly,
		onDeleteWithContext
	}: {
		open: boolean;
		chatId: string;
		chatTitle: string;
		onDeleteChatOnly: (id: string) => void;
		onDeleteWithContext: (id: string) => void;
	} = $props();

	function handleKeepMemories() {
		open = false;
		onDeleteChatOnly(chatId);
	}

	function handleForgetEverything() {
		open = false;
		onDeleteWithContext(chatId);
	}
</script>

<AlertDialog.Root bind:open>
	<AlertDialog.Content class="max-w-sm gap-0 overflow-hidden p-0">
		<div class="p-6 pb-5">
			<AlertDialog.Header class="gap-1.5">
				<AlertDialog.Title class="text-base">Before you delete…</AlertDialog.Title>
				<AlertDialog.Description class="text-sm text-muted-foreground">
					Should your AI remember what you talked about in
					<span class="font-medium text-foreground">"{chatTitle}"</span>?
				</AlertDialog.Description>
			</AlertDialog.Header>

			<div class="mt-5 flex flex-col gap-2.5">
				<button
					onclick={handleKeepMemories}
					class="group flex items-start gap-3.5 rounded-xl border border-border bg-muted/40 p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
				>
					<div
						class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/20"
					>
						<Brain class="size-4" />
					</div>
					<div class="flex flex-col gap-0.5">
						<span class="text-sm font-medium text-foreground">Yes, keep the memories</span>
						<span class="text-xs text-muted-foreground">
							Delete the chat, but the AI can still reference this conversation in future chats.
						</span>
					</div>
				</button>

				<button
					onclick={handleForgetEverything}
					class="group flex items-start gap-3.5 rounded-xl border border-border bg-muted/40 p-4 text-left transition-colors hover:border-destructive/40 hover:bg-destructive/5"
				>
					<div
						class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive transition-colors group-hover:bg-destructive/20"
					>
						<Trash2 class="size-4" />
					</div>
					<div class="flex flex-col gap-0.5">
						<span class="text-sm font-medium text-foreground">No, forget everything</span>
						<span class="text-xs text-muted-foreground">
							Delete the chat and clear the AI's memory of this conversation entirely.
						</span>
					</div>
				</button>
			</div>
		</div>

		<div class="border-t border-border bg-muted/30 px-6 py-3">
			<AlertDialog.Cancel
				class="w-full text-xs text-muted-foreground hover:text-foreground"
				onclick={() => (open = false)}
			>
				Actually, keep the chat
			</AlertDialog.Cancel>
		</div>
	</AlertDialog.Content>
</AlertDialog.Root>
