<script module lang="ts">
	import { getContext, setContext } from 'svelte';

	export type NodeType = 'start' | 'end' | 'llm' | 'classifier';

	export interface DnDContext {
		current: NodeType | null;
	}

	const DND_CONTEXT_KEY = 'flow-dnd';

	export function setDnDContext(): DnDContext {
		let dndType = $state<NodeType | null>(null);

		const ctx: DnDContext = {
			set current(value: NodeType | null) {
				dndType = value;
			},
			get current() {
				return dndType;
			}
		};

		setContext(DND_CONTEXT_KEY, ctx);
		return ctx;
	}

	export function useDnD(): DnDContext {
		const ctx = getContext<DnDContext>(DND_CONTEXT_KEY);
		if (!ctx) {
			throw new Error('useDnD must be used within a DnD context. Call setDnDContext() first.');
		}
		return ctx;
	}
</script>
