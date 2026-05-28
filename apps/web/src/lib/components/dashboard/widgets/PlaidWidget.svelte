<script lang="ts">
	import { Wallet, Lock } from '@lucide/svelte';
	import { Badge } from '$lib/components/shadcn/badge/index.js';
</script>

<div class="flex min-h-32 flex-col items-center justify-center gap-4 p-6">
	<div class="rounded-full bg-muted/40 p-4">
		<Wallet class="size-8 text-muted-foreground/50" />
	</div>
	<div class="flex flex-col items-center gap-1.5 text-center">
		<h3 class="text-sm font-medium text-foreground">Bank Accounts</h3>
		<p class="max-w-48 text-xs leading-relaxed text-muted-foreground">
			Connect your bank accounts to track balances and transactions in real time.
		</p>
	</div>
	<Badge variant="outline" class="gap-1.5 text-xs">
		<Lock class="size-3" />
		Coming Soon
	</Badge>
</div>
