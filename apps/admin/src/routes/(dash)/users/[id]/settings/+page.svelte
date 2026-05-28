<script lang="ts">
	import * as Accordion from '$lib/components/shadcn/accordion';
	import { Badge } from '$lib/components/shadcn/badge';
	import { Switch } from '$lib/components/shadcn/switch';
	import { Settings } from '@lucide/svelte';
	import { getUserCustomizations } from '../user-details.remote';

	const customizationsQuery = getUserCustomizations();
	const customizations = $derived(customizationsQuery.current);
</script>

<div class="px-4 lg:px-6">
	{#if customizationsQuery.loading}
		<div class="flex items-center justify-center py-20">
			<div
				class="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"
			></div>
		</div>
	{:else if customizationsQuery.error}
		<div class="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
			<p class="text-sm font-medium text-destructive">Error loading customizations</p>
			<p class="mt-1 text-xs text-destructive/70">{customizationsQuery.error.message}</p>
		</div>
	{:else if (customizations?.length ?? 0) === 0}
		<div class="flex flex-col items-center justify-center py-20 text-center">
			<Settings class="mb-3 h-8 w-8 text-muted-foreground/30" />
			<p class="text-sm text-muted-foreground">No customization records</p>
		</div>
	{:else if customizations}
		<Accordion.Root type="multiple" class="w-full">
			{#each customizations as item, idx}
				{@const entries =
					typeof item.value === 'object' && item.value !== null ? Object.entries(item.value) : []}
				{@const booleans = entries.filter(([_, v]) => typeof v === 'boolean')}
				{@const primitives = entries.filter(
					([_, v]) => typeof v === 'string' || typeof v === 'number'
				)}
				{@const complex = entries.filter(
					([_, v]) => Array.isArray(v) || (typeof v === 'object' && v !== null)
				)}
				<Accordion.Item value={`item-${idx}`} class="border-b last:border-b-0">
					<Accordion.Trigger class="hover:no-underline">
						<div class="flex items-center gap-3">
							<span class="text-sm font-medium">
								{(item.key ?? '')
									.replace(/_/g, ' ')
									.replace(/\b\w/g, (l: string) => l.toUpperCase())}
							</span>
							<Badge variant="secondary" class="text-[10px]">
								{entries.length}
								{entries.length === 1 ? 'setting' : 'settings'}
							</Badge>
						</div>
					</Accordion.Trigger>
					<Accordion.Content>
						<div class="space-y-4 pb-2">
							{#if booleans.length > 0}
								<div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
									{#each booleans as [key, value]}
										<div
											class="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2"
										>
											<span class="text-xs text-muted-foreground">
												{key
													.replace(/_/g, ' ')
													.replace(/([A-Z])/g, ' $1')
													.trim()}
											</span>
											<Switch checked={value} disabled class="scale-75" />
										</div>
									{/each}
								</div>
							{/if}

							{#if primitives.length > 0}
								<div class="rounded-lg border">
									<table class="w-full text-sm">
										<tbody class="divide-y">
											{#each primitives as [key, value]}
												<tr class="hover:bg-muted/30">
													<td class="px-3 py-2 text-xs text-muted-foreground">
														{key
															.replace(/_/g, ' ')
															.replace(/([A-Z])/g, ' $1')
															.trim()}
													</td>
													<td class="px-3 py-2 text-right font-mono text-xs">{value}</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							{/if}

							{#if complex.length > 0}
								{#each complex as [key, value]}
									<div class="space-y-1.5">
										<p class="text-xs font-medium text-muted-foreground">
											{key
												.replace(/_/g, ' ')
												.replace(/([A-Z])/g, ' $1')
												.trim()}
										</p>
										{#if Array.isArray(value)}
											<div class="flex flex-wrap gap-1.5">
												{#each value as v}
													{#if typeof v === 'object' && v !== null && 'id' in v}
														<Badge variant="outline" class="text-[10px] font-normal">
															{v.id}{v.size ? ` · ${v.size}` : ''}
														</Badge>
													{:else}
														<Badge variant="outline" class="text-[10px] font-normal">
															{typeof v === 'object' ? JSON.stringify(v) : v}
														</Badge>
													{/if}
												{/each}
											</div>
										{:else}
											<pre
												class="rounded-md bg-muted/40 p-3 text-[11px] leading-relaxed">{JSON.stringify(
													value,
													null,
													2
												)}</pre>
										{/if}
									</div>
								{/each}
							{/if}
						</div>
					</Accordion.Content>
				</Accordion.Item>
			{/each}
		</Accordion.Root>
	{/if}
</div>
