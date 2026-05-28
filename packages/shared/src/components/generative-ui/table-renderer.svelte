<!--
  TableRenderer - Renders AI-generated data tables
  Displays structured data with column alignment and styling
-->
<script lang="ts">
	import * as Card from '$ui/card';
	import * as Table from '$ui/table';
	import type { TableOutput } from '../../types/generative-ui';

	interface Props {
		output: TableOutput;
	}

	let { output }: Props = $props();

	function getAlignClass(align?: 'left' | 'center' | 'right'): string {
		switch (align) {
			case 'center':
				return 'text-center';
			case 'right':
				return 'text-right';
			default:
				return 'text-left';
		}
	}

	function formatCellValue(value: string | number | boolean): string {
		if (typeof value === 'boolean') {
			return value ? '✓' : '✗';
		}
		if (typeof value === 'number') {
			// Format numbers with appropriate precision
			if (Number.isInteger(value)) {
				return value.toLocaleString();
			}
			return value.toLocaleString(undefined, {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2
			});
		}
		return String(value);
	}
</script>

<Card.Root class="w-full">
	<Card.Header class="pb-2">
		<Card.Title class="text-base">{output.title}</Card.Title>
		{#if output.description}
			<Card.Description>{output.description}</Card.Description>
		{/if}
	</Card.Header>
	<Card.Content class="px-0 pb-0">
		<div class="overflow-x-auto">
			<Table.Root>
				<Table.Header>
					<Table.Row class="hover:bg-transparent">
						{#each output.columns as col}
							<Table.Head class={getAlignClass(col.align)}>
								{col.label}
							</Table.Head>
						{/each}
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#if output.rows.length === 0}
						<Table.Row>
							<Table.Cell
								colspan={output.columns.length}
								class="py-8 text-center text-muted-foreground"
							>
								No data available
							</Table.Cell>
						</Table.Row>
					{:else}
						{#each output.rows as row}
							<Table.Row>
								{#each output.columns as col}
									<Table.Cell class={getAlignClass(col.align)}>
										{formatCellValue(row[col.key])}
									</Table.Cell>
								{/each}
							</Table.Row>
						{/each}
					{/if}
				</Table.Body>
			</Table.Root>
		</div>
	</Card.Content>
	{#if output.rows.length > 0}
		<Card.Footer class="text-xs text-muted-foreground">
			{output.rows.length} row{output.rows.length !== 1 ? 's' : ''}
		</Card.Footer>
	{/if}
</Card.Root>
