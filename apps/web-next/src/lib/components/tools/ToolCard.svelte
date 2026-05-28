<script lang="ts">
	import { FlaskConical, Plus } from '@lucide/svelte';
	import { cn } from '$lib/utils';

	type IconComponent = typeof FlaskConical;

	type Props = {
		title: string;
		tag?: string;
		description?: string;
		href?: string;
		icon?: IconComponent | string;
		onclick?: () => void;
		onAdd?: () => void;
		class?: string;
	};

	let {
		title,
		tag,
		description = 'No description available.',
		href,
		icon: Icon = FlaskConical,
		onclick,
		onAdd,
		class: className
	}: Props = $props();
</script>

{#snippet cardContent()}
	<div
		class={cn(
			'group relative flex h-full w-full items-start gap-4 rounded-2xl border border-white bg-[#F6F6F6] px-6 py-5 text-left transition-all duration-200',
			'hover:-translate-y-0.5 hover:shadow-sm group-focus-visible/card:ring-3 group-focus-visible/card:ring-primary/20',
			className
		)}
	>
		<div class="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-[#F5D9C5] bg-[#F6F6F6] text-[#904EFF]">
			{#if typeof Icon === 'string'}
				<img src={Icon} alt="" class="size-7 object-contain" />
			{:else}
				<Icon class="size-7 stroke-[1.75]" />
			{/if}
		</div>

		<div class="min-w-0 flex-1">
			<div class="flex min-w-0 items-center gap-3">
				<h3 class="truncate text-lg font-semibold tracking-[-0.02em] text-[#14213D]">
					{title}
				</h3>

				{#if tag}
					<span class="shrink-0 rounded-full text-sm font-medium capitalize text-[#A259FF]">
						{tag}
					</span>
				{/if}
			</div>

			<p class="mt-5 line-clamp-3 text-base leading-relaxed font-normal text-muted-foreground">
				{description}
			</p>
		</div>

		<span class="mt-1 flex size-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 group-hover:bg-black/5">
			<Plus class="size-7 stroke-[1.75] text-[#7C8092]" />
		</span>
	</div>
{/snippet}

{#if href}
	<a href={href} class="group/card block h-full rounded-2xl outline-none">
		{@render cardContent()}
	</a>
{:else}
	<button
		type="button"
		onclick={onclick ?? onAdd}
		class="group/card block h-full w-full rounded-2xl text-left outline-none"
	>
		{@render cardContent()}
	</button>
{/if}