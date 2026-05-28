<script lang="ts">
	import {
		BriefcaseBusiness,
		ChevronDown,
		Mail,
		MapPin,
		MessageSquareText,
		Pencil,
		Phone,
		Sparkles,
		TrendingUp,
		User
	} from '@lucide/svelte';

	import { Button } from '$lib/components/ui/button/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';

	import AnalyticsBars from './AnalyticsBars.svelte';
	import MemoryStatusBadge from './MemoryStatusBadge.svelte';
	import MemorySurfaceCard from './MemorySurfaceCard.svelte';
	import ProgressRing from './ProgressRing.svelte';

	type InterestChip = {
		label: string;
		accent?: boolean;
		muted?: boolean;
	};

	type CommunicationPreference = {
		label: string;
		description: string;
		enabled: boolean;
	};

	type Metric = {
		label: string;
		value: number;
	};

	const interestChips: InterestChip[] = [
		{ label: 'Technology', accent: true },
		{ label: 'ESG' },
		{ label: 'FinTech', accent: true },
		{ label: 'Industrials', muted: true },
		{ label: 'Healthcare' }
	];

	let communicationPreferences = $state<CommunicationPreference[]>([
		{
			label: 'Weekly Performance Digest',
			description: 'Sent every Monday at 6:00 AM',
			enabled: true
		},
		{
			label: 'Real-time Volatility Alerts',
			description: 'Push notifications for sharp moves',
			enabled: false
		}
	]);

	const analyticsMetrics: Metric[] = [
		{ label: 'Data Accuracy', value: 94 },
		{ label: 'Market Alignment', value: 82 }
	];

	const analyticsBars = [
		{ height: 62 },
		{ height: 104 },
		{ height: 142, accent: true },
		{ height: 76 },
		{ height: 122 },
		{ height: 88 },
		{ height: 154, accent: true },
		{ height: 54 },
		{ height: 112 },
		{ height: 136 }
	];

	function chipClass(chip: InterestChip) {
		if (chip.accent) return 'border-[#E0D5FF] bg-[#F4F0FF] text-[#7C4DFF]';
		if (chip.muted) return 'border-[#E3E9F3] bg-[#F7F9FC] text-[#667085]';
		return 'border-[#E8EAF4] bg-white text-[#667085]';
	}
</script>

<div class="mt-6 flex flex-col gap-4">
	<MemorySurfaceCard class="px-4 py-4 md:px-5 md:py-4.5">
		<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
			<div class="flex items-center gap-4">
				<ProgressRing value={57} label="57%" />

				<div class="max-w-xl">
					<h2 class="text-lg font-semibold text-[#25324B] md:text-xl">Complete your profile</h2>
					<p class="mt-1 text-sm leading-6 text-[#7B8794] md:text-[15px]">
						Completing your information helps our AI engine provide more accurate performance
						analytics and better investment task matching.
					</p>
				</div>
			</div>

			<Button
				href="/chat-detail"
				class="h-11 rounded-2xl bg-[#7C4DFF] px-5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(124,77,255,0.28)] hover:-translate-y-0.5 hover:bg-[#7347F1]"
			>
				New Analysis
			</Button>
		</div>
	</MemorySurfaceCard>

	<div class="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
		<MemorySurfaceCard class="min-h-90 px-4 py-4">
			<div class="flex items-start justify-between gap-3">
				<div
					class="flex size-9 items-center justify-center rounded-2xl bg-[#F2ECFF] text-[#7C4DFF]"
				>
					<User class="size-4" />
				</div>
			</div>

			<div class="mt-8">
				<div class="flex items-center gap-2">
					<h3 class="text-lg font-semibold text-[#25324B]">Basics</h3>
					<MemoryStatusBadge label="67%" />
				</div>

				<p class="mt-3 text-sm leading-6 text-[#7B8794]">
					General identification and role details.
				</p>
			</div>
		</MemorySurfaceCard>

		<MemorySurfaceCard class="min-h-90 px-5 py-5">
			<div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
				<div class="flex items-start gap-3">
					<div
						class="flex size-9 items-center justify-center rounded-2xl bg-[#F2ECFF] text-[#7C4DFF]"
					>
						<BriefcaseBusiness class="size-4" />
					</div>

					<div>
						<div class="flex flex-wrap items-center gap-2">
							<h3 class="text-lg font-semibold text-[#25324B]">Personal Information</h3>
							<MemoryStatusBadge label="100%" tone="mint" />
						</div>
						<p class="mt-1 text-sm text-[#7B8794]">Contact and professional background.</p>
					</div>
				</div>

				<Button
					variant="ghost"
					type="button"
					class="h-auto px-0 text-sm font-semibold text-[#7C4DFF] hover:bg-transparent hover:text-[#6D42E8]"
				>
					<Pencil data-icon="inline-start" />
					Edit details
				</Button>
			</div>

			<div class="mt-7 grid gap-5 md:grid-cols-2 md:gap-x-8">
				<div class="space-y-5">
					<div>
						<p class="text-[10px] font-semibold tracking-[0.12em] text-[#98A2B3] uppercase">
							Email Address
						</p>
						<div class="mt-2 flex items-center gap-2 text-[#25324B]">
							<Mail class="size-4 text-[#B8C0CC]" />
							<p class="text-base font-semibold">alex.chen@quantpm.ai</p>
						</div>
					</div>

					<div>
						<p class="text-[10px] font-semibold tracking-[0.12em] text-[#98A2B3] uppercase">
							Phone Number
						</p>
						<div class="mt-2 flex items-center gap-2 text-[#25324B]">
							<Phone class="size-4 text-[#B8C0CC]" />
							<p class="text-base font-semibold">+1 (555) 942-0392</p>
						</div>
					</div>

					<div>
						<p class="text-[10px] font-semibold tracking-[0.12em] text-[#98A2B3] uppercase">
							Location
						</p>
						<div class="mt-2 flex items-center gap-2 text-[#25324B]">
							<MapPin class="size-4 text-[#B8C0CC]" />
							<p class="text-base font-semibold">New York, USA</p>
						</div>
					</div>
				</div>

				<div class="space-y-5">
					<div>
						<p class="text-[10px] font-semibold tracking-[0.12em] text-[#98A2B3] uppercase">
							AI Focus
						</p>
						<p class="mt-2 text-sm leading-7 text-[#667085]">
							&quot;Passionate about leveraging AI for superior risk-adjusted returns in
							high-volatility environments.&quot;
						</p>
					</div>

					<div>
						<p class="text-[10px] font-semibold tracking-[0.12em] text-[#98A2B3] uppercase">
							Experience
						</p>
						<div class="mt-3 flex flex-wrap gap-2">
							<MemoryStatusBadge label="8+ Years" tone="slate" class="text-[11px]" />
							<MemoryStatusBadge label="CFA L3" tone="slate" class="text-[11px]" />
						</div>
					</div>
				</div>
			</div>
		</MemorySurfaceCard>
	</div>

	<div class="grid gap-4 xl:grid-cols-[1.08fr_1fr]">
		<MemorySurfaceCard class="min-h-66 px-5 py-5">
			<div class="flex items-start gap-3">
				<div
					class="flex size-9 items-center justify-center rounded-2xl bg-[#F2ECFF] text-[#7C4DFF]"
				>
					<TrendingUp class="size-4" />
				</div>

				<div>
					<div class="flex flex-wrap items-center gap-2">
						<h3 class="text-lg font-semibold text-[#25324B]">Investment Interests</h3>
						<MemoryStatusBadge label="33%" />
					</div>
					<p class="mt-1 text-sm text-[#7B8794]">Sectors and asset classes you track.</p>
				</div>
			</div>

			<div class="mt-6 flex flex-wrap gap-2.5">
				{#each interestChips as chip}
					<span
						class={`inline-flex items-center rounded-2xl border px-3 py-2 text-sm font-medium ${chipClass(chip)}`}
					>
						{chip.label}
					</span>
				{/each}

				<Button
					variant="outline"
					type="button"
					size="icon"
					class="rounded-2xl border-dashed border-[#D8DDEA] bg-white text-[#B6BFCD] hover:bg-[#F8FAFC]"
				>
					<Sparkles class="size-4" />
				</Button>
			</div>
		</MemorySurfaceCard>

		<MemorySurfaceCard class="min-h-66 px-5 py-5">
			<div class="flex items-start gap-3">
				<div
					class="flex size-9 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#5D7BFF]"
				>
					<MessageSquareText class="size-4" />
				</div>

				<div>
					<div class="flex flex-wrap items-center gap-2">
						<h3 class="text-lg font-semibold text-[#25324B]">Communication</h3>
						<MemoryStatusBadge label="Action Required" tone="coral" />
					</div>
					<p class="mt-1 text-sm text-[#7B8794]">Preferences for alerts and reports.</p>
				</div>
			</div>

			<div class="mt-6 flex flex-col gap-5">
				{#each communicationPreferences as preference, index}
					<div class="flex items-center justify-between gap-4">
						<div>
							<p class="text-sm font-semibold text-[#344054]">{preference.label}</p>
							<p class="mt-1 text-xs text-[#98A2B3]">{preference.description}</p>
						</div>

						<Switch
							bind:checked={communicationPreferences[index].enabled}
							class="data-checked:bg-[#7C4DFF] data-unchecked:bg-[#DCE6FA]"
						/>
					</div>
				{/each}
			</div>
		</MemorySurfaceCard>
	</div>

	<MemorySurfaceCard class="px-5 py-5">
		<div class="grid gap-6 xl:grid-cols-[0.94fr_1.06fr] xl:items-end">
			<div>
				<h3 class="text-lg font-semibold text-[#25324B]">Analytics Engagement</h3>
				<p class="mt-2 max-w-sm text-sm leading-6 text-[#7B8794]">
					Your activity density over the last 30 days. Consistent profile use improves AI training
					sets.
				</p>

				<div class="mt-8 flex flex-col gap-5">
					{#each analyticsMetrics as metric}
						<div>
							<div
								class="mb-2 flex items-center justify-between gap-4 text-sm font-semibold text-[#4D5B75]"
							>
								<span>{metric.label}</span>
								<span class="text-[#7C4DFF]">{metric.value}%</span>
							</div>
							<div class="h-2 rounded-full bg-[#E5ECFA]">
								<div
									class="h-full rounded-full bg-[#7C4DFF]"
									style={`width: ${metric.value}%`}
								></div>
							</div>
						</div>
					{/each}
				</div>
			</div>

			<AnalyticsBars bars={analyticsBars} />
		</div>
	</MemorySurfaceCard>
</div>
