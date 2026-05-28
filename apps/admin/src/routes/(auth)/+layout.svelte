<script lang="ts">
	import Login from '$lib/assets/login.jpg';
	import { GalleryVerticalEndIcon } from '@lucide/svelte';

	let { children } = $props();
</script>

<svelte:boundary
	onerror={(e) => {
		console.error('Error in auth layout:', e);
	}}
>
	<div class="grid min-h-svh lg:grid-cols-2">
		<div class="flex flex-col gap-4 p-6 md:p-10">
			<div class="flex justify-center gap-2 md:justify-start">
				<a href="##" class="flex items-center gap-2 font-medium">
					<div
						class="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground"
					>
						<GalleryVerticalEndIcon class="size-4" />
					</div>
					Quant PM - Admin
				</a>
			</div>
			<div class="flex flex-1 items-center justify-center">
				<div class="w-full">
					{@render children()}
				</div>
			</div>
		</div>
		<div class="relative hidden bg-muted lg:block">
			<img
				src={Login}
				alt="placeholder"
				class="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
			/>
		</div>
	</div>
</svelte:boundary>
