<script lang="ts">
	import { Lock, Wallet } from '@lucide/svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
</script>

<div class="flex flex-col items-center justify-center gap-4 rounded-3xl border border-[#F6F6F6] bg-white p-6">
	<span class="inline-flex size-14 items-center justify-center rounded-2xl bg-[#F6F6F6]">
		<Wallet class="size-6 text-[#83899F]" />
	</span>

	<div class="flex flex-col items-center gap-1.5 text-center">
		<h3 class="text-base font-semibold text-slate-800">Bank Accounts</h3>
		<p class="max-w-52 text-sm leading-relaxed text-[#83899F]">
			Connect your bank accounts to track balances and transactions in real time.
		</p>
	</div>

	<Badge variant="outline" class="gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
		<Lock class="size-3" />
		Coming Soon
	</Badge>
</div>