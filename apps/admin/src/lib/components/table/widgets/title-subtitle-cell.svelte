<script lang="ts">
	let { title, subtitle, href }: { title: string; subtitle?: string; href?: string } = $props();
</script>

<div class="flex flex-col">
	{#if href}
		<a {href} class="truncate font-medium hover:underline">
			{title}
		</a>
	{:else}
		<span class="truncate font-medium">
			{title}
		</span>
	{/if}
	{#if subtitle}
		<span class="truncate text-xs text-muted-foreground">
			{subtitle}
		</span>
	{/if}
</div>
