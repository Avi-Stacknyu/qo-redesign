<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { Badge } from '$lib/components/shadcn/badge/index.js';
	import { Users, Crown, Briefcase, Shield, Mail, Edit2, Trash2 } from '@lucide/svelte';

	interface MemberData {
		id: string;
		name: string;
		role?: string;
		email?: string;
		parent_id?: string;
		responsibilities?: string[];
		onEdit: (id: string) => void;
		onDelete: (id: string, name: string) => void;
	}

	let { data }: { data: MemberData } = $props();

	function getRoleIcon(role?: string) {
		if (!role) return Users;
		const lower = role.toLowerCase();
		if (lower.includes('head') || lower.includes('patriarch') || lower.includes('matriarch'))
			return Crown;
		if (lower.includes('manager') || lower.includes('director') || lower.includes('officer'))
			return Briefcase;
		if (lower.includes('advisor') || lower.includes('trustee') || lower.includes('legal'))
			return Shield;
		return Users;
	}

	const RoleIcon = $derived(getRoleIcon(data.role));

	function getInitials(name: string): string {
		return name
			.split(' ')
			.map((w) => w[0])
			.join('')
			.toUpperCase()
			.slice(0, 2);
	}
</script>

<!-- Target handle (top) — receives edges from parent -->
<Handle
	type="target"
	position={Position.Top}
	isConnectable={true}
	style="width: 14px; height: 14px; background: var(--background); border: 2px solid var(--primary); pointer-events: all; cursor: crosshair; z-index: 10; opacity: 1;"
/>

<div class="group relative w-60">
	<!-- Drag handle region -->
	<div
		class="drag-handle cursor-grab rounded-xl border border-border/40 bg-card/90 shadow-md backdrop-blur transition-all hover:border-border/60 hover:shadow-lg active:cursor-grabbing"
	>
		<!-- Hover action buttons -->
		<div
			class="absolute -top-2 -right-2 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"
		>
			<button
				onclick={(e) => {
					e.stopPropagation();
					data.onEdit(data.id);
				}}
				class="flex size-6 items-center justify-center rounded-full border border-border/50 bg-background text-muted-foreground shadow-sm transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
				title="Edit"
			>
				<Edit2 class="size-3" />
			</button>
			<button
				onclick={(e) => {
					e.stopPropagation();
					data.onDelete(data.id, data.name);
				}}
				class="flex size-6 items-center justify-center rounded-full border border-destructive/30 bg-background text-muted-foreground shadow-sm transition-colors hover:bg-destructive/10 hover:text-destructive"
				title="Remove"
			>
				<Trash2 class="size-3" />
			</button>
		</div>

		<div class="p-4">
			<!-- Avatar + Name -->
			<div class="flex items-center gap-3">
				<div
					class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
				>
					{getInitials(data.name)}
				</div>
				<div class="min-w-0 flex-1">
					<p class="truncate text-sm font-semibold text-foreground">{data.name}</p>
					{#if data.role}
						<p class="truncate text-[11px] text-muted-foreground">{data.role}</p>
					{/if}
				</div>
				<RoleIcon class="size-4 shrink-0 text-muted-foreground/50" />
			</div>

			<!-- Email -->
			{#if data.email}
				<div class="mt-2.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
					<Mail class="size-3 shrink-0" />
					<span class="truncate">{data.email}</span>
				</div>
			{/if}

			<!-- Responsibilities -->
			{#if data.responsibilities && data.responsibilities.length > 0}
				<div class="mt-2.5 flex flex-wrap gap-1">
					{#each data.responsibilities.slice(0, 3) as r (r)}
						<Badge variant="secondary" class="text-[9px] leading-none font-normal">{r}</Badge>
					{/each}
					{#if data.responsibilities.length > 3}
						<Badge variant="outline" class="text-[9px] leading-none font-normal">
							+{data.responsibilities.length - 3}
						</Badge>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- Source handle (bottom) — sends edges to children -->
<Handle
	type="source"
	position={Position.Bottom}
	isConnectable={true}
	style="width: 14px; height: 14px; background: var(--background); border: 2px solid var(--primary); pointer-events: all; cursor: crosshair; z-index: 10; opacity: 1;"
/>
