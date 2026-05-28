<script lang="ts">
	import { Badge } from '$lib/components/shadcn/badge';
	import type { BadgeVariant } from '$lib/components/shadcn/badge';

	let { value, variant = 'default' }: { value: string; variant?: BadgeVariant } = $props();
</script>

<Badge {variant}>
	{value}
</Badge>
