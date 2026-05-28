<script lang="ts">
	import * as Avatar from '$lib/components/shadcn/avatar/index.js';
	import { Button } from '$lib/components/shadcn/button/index.js';
	import * as Card from '$lib/components/shadcn/card/index.js';
	import { Input } from '$lib/components/shadcn/input/index.js';
	import { Label } from '$lib/components/shadcn/label/index.js';
	import { ALL_TIMEZONES, getCountryName, getTimezonesForCountry } from '$lib/data/location';
	import { updateUserDisplayName } from '$lib/remote/profile.remote';
	import { saveHomeLocation, type HomeLocation } from '$lib/remote/settings.remote';
	import { dashboard } from '$lib/state/dashboard.svelte';
	import { Camera, Loader2, Mail, Save, Trash2, User } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';

	let {
		userName,
		userEmail,
		userAvatar,
		homeLocation
	}: {
		userName: string;
		userEmail: string;
		userAvatar: string;
		homeLocation: HomeLocation;
	} = $props();

	let name = $derived(userName);
	let isSaving = $state(false);
	let avatarUrl = $derived(userAvatar);
	let isUploadingAvatar = $state(false);
	let fileInput: HTMLInputElement | undefined = $state();

	let country = $derived(homeLocation.country);
	let timezone = $derived(homeLocation.timezone);
	let city = $derived(homeLocation.city);
	let locationSaving = $state(false);

	let timezoneOptions = $derived(country ? getTimezonesForCountry(country) : ALL_TIMEZONES);

	let countryDisplayLabel = $derived(
		country ? `${getCountryName(country)} (${country})` : 'Select country'
	);

	let timezoneDisplayLabel = $derived(
		timezone
			? (timezoneOptions.find((t) => t.value === timezone)?.label ?? timezone)
			: 'Select timezone'
	);

	let initials = $derived(
		name
			.split(' ')
			.map((n) => n[0])
			.join('')
			.toUpperCase()
			.slice(0, 2) || '?'
	);

	let hasNameChanges = $derived(name !== userName);
	let hasLocationChanges = $derived(
		country !== homeLocation.country ||
			timezone !== homeLocation.timezone ||
			city !== homeLocation.city
	);

	function handleCountryChange(code: string) {
		country = code;
		const zones = getTimezonesForCountry(code);
		if (zones.length === 1) {
			timezone = zones[0].value;
		} else if (!zones.find((z) => z.value === timezone)) {
			timezone = '';
		}
	}

	async function handleSaveProfile() {
		if (!hasNameChanges) return;
		isSaving = true;
		try {
			await updateUserDisplayName({ name });
			toast.success('Display name updated');
		} catch {
			toast.error('Failed to update display name');
		} finally {
			isSaving = false;
		}
	}

	async function handleAvatarUpload(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		isUploadingAvatar = true;
		const formData = new FormData();
		formData.append('avatar', file);

		try {
			const res = await fetch('/api/avatar', { method: 'POST', body: formData });
			if (!res.ok) {
				const err = await res.json().catch(() => ({ message: 'Upload failed' }));
				throw new Error(err.message ?? 'Upload failed');
			}
			const { avatar } = await res.json();
			avatarUrl = avatar;
			toast.success('Avatar updated');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to upload avatar');
		} finally {
			isUploadingAvatar = false;
			input.value = '';
		}
	}

	async function handleAvatarRemove() {
		isUploadingAvatar = true;
		try {
			const res = await fetch('/api/avatar', { method: 'DELETE' });
			if (!res.ok) throw new Error('Failed to remove avatar');
			avatarUrl = '';
			toast.success('Avatar removed');
		} catch {
			toast.error('Failed to remove avatar');
		} finally {
			isUploadingAvatar = false;
		}
	}

	async function handleSaveLocation() {
		if (!hasLocationChanges) return;
		locationSaving = true;
		try {
			await saveHomeLocation({ country, timezone, city });
			toast.success('Location updated');
		} catch {
			toast.error('Failed to save location');
		} finally {
			locationSaving = false;
		}
	}
</script>

<section class="flex flex-col gap-5" aria-label="Profile settings">
	<div class="flex flex-col gap-20">
		<section class="flex flex-col gap-1">
			<h1 class="font-Inter text-3xl font-medium text-primary">Profile Information</h1>
			<p class="text-muted-foreground">Your personal details and public identity.</p>
		</section>

		<section class="flex flex-col gap-8">
			<div class="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
				<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
					<div class="relative">
						<Button
							class="size-[6rem] rounded-full bg-white p-0 shadow-sm"
							variant="secondary"
							onclick={() => fileInput?.click()}
						>
							<Avatar.Root class="size-[6rem]">
								{#if avatarUrl}
									<Avatar.Image class="rounded-full object-cover" src={avatarUrl} alt={name} />
								{/if}
								<Avatar.Fallback class="rounded-full bg-linear-to-br from-primary/20 to-primary/5 text-2xl font-semibold text-primary">
									{initials}
								</Avatar.Fallback>
							</Avatar.Root>
						</Button>
						<button
							type="button"
							onclick={() => fileInput?.click()}
							disabled={isUploadingAvatar}
							class="absolute -right-1 -bottom-1 flex size-8 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-md transition-all hover:scale-105 hover:bg-primary/90 disabled:opacity-50"
						>
							{#if isUploadingAvatar}
								<Loader2 class="size-4 animate-spin" />
							{:else}
								<Camera class="size-4" />
							{/if}
						</button>
						<input
							bind:this={fileInput}
							type="file"
							accept="image/jpeg,image/png,image/webp,image/gif"
							class="hidden"
							onchange={handleAvatarUpload}
						/>
					</div>

					<div>
						<h3 class="font-Inter text-xl font-medium text-primary">{name}</h3>
						<p class="text-muted-foreground">{userEmail}</p>
						{#if avatarUrl}
							<button
								type="button"
								onclick={handleAvatarRemove}
								disabled={isUploadingAvatar}
								class="mt-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
							>
								<Trash2 class="size-3.5" />
								Remove avatar
							</button>
						{/if}
					</div>
				</div>

				<div class="flex gap-3">
					<Button
						class="rounded-full px-6"
						onclick={handleSaveProfile}
						disabled={!hasNameChanges || isSaving}
					>
						{#if isSaving}
							<Loader2 class="mr-2 size-4 animate-spin" />
							Saving
						{:else}
							<Save class="mr-2 size-4" />
							Save
						{/if}
					</Button>
					<Button
						variant="outline"
						class="rounded-full px-6"
						onclick={() => (name = userName)}
						disabled={!hasNameChanges || isSaving}
					>
						Cancel
					</Button>
				</div>
			</div>

			<div class="grid gap-6 xl:grid-cols-2">
				<div class="flex w-full flex-col gap-2">
					<Label for="profile-name" class="font-Inter text-sm text-primary dark:text-neutral-200">
						Full Name
					</Label>
					<Input
						id="profile-name"
						bind:value={name}
						placeholder="Your full name"
						class="h-12 rounded-xl border-0 bg-white px-4 text-sm shadow-none ring-0 placeholder:text-neutral-400 focus-visible:ring-1 focus-visible:ring-neutral-300 dark:bg-neutral-900"
					/>
				</div>

				<div class="flex w-full flex-col gap-2">
					<Label for="profile-email" class="font-Inter text-sm text-primary dark:text-neutral-200">
						Email
					</Label>
					<Input
						id="profile-email"
						value={userEmail}
						disabled
						class="h-12 rounded-xl border-0 bg-white px-4 text-sm shadow-none ring-0 placeholder:text-neutral-400 dark:bg-neutral-900"
					/>
					<p class="text-sm text-muted-foreground">Email cannot be changed from this page.</p>
				</div>
			</div>
		</section>
	</div>

	<!-- <Separator class="bg-border/30" />

	<div class="space-y-1">
		<h2 class="text-xl font-semibold tracking-tight text-foreground">Home Location</h2>
		<p class="text-sm text-muted-foreground">
			Used for localizing market data, timezones, and news.
		</p>
	</div>

	<Card.Root class="overflow-hidden rounded-xl border-border/40 bg-card/90 shadow-lg backdrop-blur">
		<Card.Content class="p-6">
			<div class="grid gap-4 sm:grid-cols-3">
				<div class="space-y-2">
					<Label class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
						Country
					</Label>
					<Select.Root type="single" value={country} onValueChange={handleCountryChange}>
						<Select.Trigger
							class="h-10 w-full rounded-lg border-border/40 bg-muted/30 text-sm transition-colors hover:bg-muted/50"
						>
							<Globe class="mr-2 size-4 shrink-0 text-muted-foreground/50" />
							<span class="truncate">{countryDisplayLabel}</span>
						</Select.Trigger>
						<Select.Content class="max-h-60 rounded-lg">
							{#each COUNTRIES as c (c.code)}
								<Select.Item value={c.code} class="text-sm">
									{c.name} ({c.code})
								</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
				<div class="space-y-2">
					<Label class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
						Timezone
					</Label>
					<Select.Root type="single" value={timezone} onValueChange={(v) => (timezone = v)}>
						<Select.Trigger
							class="h-10 w-full rounded-lg border-border/40 bg-muted/30 text-sm transition-colors hover:bg-muted/50"
						>
							<Clock class="mr-2 size-4 shrink-0 text-muted-foreground/50" />
							<span class="truncate">{timezoneDisplayLabel}</span>
						</Select.Trigger>
						<Select.Content class="max-h-60 rounded-lg">
							{#each timezoneOptions as tz (tz.value)}
								<Select.Item value={tz.value} class="text-sm">
									{tz.label}
								</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
				<div class="space-y-2">
					<Label
						for="loc-city"
						class="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
					>
						City
					</Label>
					<div class="relative">
						<MapPin
							class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground/50"
						/>
						<Input
							id="loc-city"
							bind:value={city}
							placeholder="New York"
							class="h-10 rounded-lg border-border/40 bg-muted/30 pl-10 text-sm transition-colors focus:border-primary/50 focus:bg-background"
						/>
					</div>
				</div>
			</div>
		</Card.Content>

		{#if hasLocationChanges}
			<Card.Footer class="border-t border-border/30 bg-muted/20 px-6 py-3">
				<div class="flex w-full items-center justify-end gap-3">
					<Button
						variant="ghost"
						size="sm"
						class="text-xs text-muted-foreground"
						onclick={() => {
							country = homeLocation.country;
							timezone = homeLocation.timezone;
							city = homeLocation.city;
						}}
					>
						Cancel
					</Button>
					<Button
						size="sm"
						class="gap-2 rounded-lg px-4 text-xs"
						onclick={handleSaveLocation}
						disabled={locationSaving}
					>
						{#if locationSaving}
							<Loader2 class="size-3.5 animate-spin" />
							Saving…
						{:else}
							<Save class="size-3.5" />
							Save Location
						{/if}
					</Button>
				</div>
			</Card.Footer>
		{/if}
	</Card.Root> -->
</section>
