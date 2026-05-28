import type { AiAgentModelRow, AiPricingRateRow, AiPromptRow, AiProviderRow } from '@repo/db/types';

export type InfraModelResponse = AiAgentModelRow & {
	expand?: { provider?: AiProviderRow; current_pricing?: AiPricingRateRow };
};

export type VersionedConfigRow = {
	configKey: string;
	active: InfraModelResponse | null;
	latest: InfraModelResponse;
	versions: InfraModelResponse[];
	current: InfraModelResponse;
	versionCount: number;
	providerLabel: string;
	pricingLabel: string;
};

export type VersionedPromptRow = {
	promptKey: string;
	active: AiPromptRow | null;
	latest: AiPromptRow;
	versions: AiPromptRow[];
	current: AiPromptRow;
	versionCount: number;
	preview: string;
	lineCount: number;
};

function byCreatedDesc<T extends { created: string | null }>(left: T, right: T): number {
	return (right.created ?? '').localeCompare(left.created ?? '');
}

export function formatStamp(value?: string): string {
	if (!value) return 'Unknown';
	return value.replace('T', ' ').slice(0, 16);
}

export function excerpt(value?: string, max = 180): string {
	if (!value) return 'No content';
	const compact = value.replace(/\s+/g, ' ').trim();
	if (compact.length <= max) return compact;
	return `${compact.slice(0, max).trimEnd()}...`;
}

export function countLines(value?: string): number {
	if (!value) return 0;
	return value.split(/\r?\n/).length;
}

export function labelForServiceType(value?: string): string {
	if (!value) return 'Unknown';
	return value
		.split('_')
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

export function labelForPricing(pricing?: AiPricingRateRow): string {
	if (!pricing) return 'No pricing linked';
	const ppc = pricing.pricePerCall != null ? Number(pricing.pricePerCall) : 0;
	if (ppc > 0) {
		return `$${ppc.toFixed(6)} per call`;
	}
	const ipp = pricing.inputPricePer1M != null ? Number(pricing.inputPricePer1M) : 0;
	if (ipp > 0) {
		return `$${ipp.toFixed(3)} input / 1M`;
	}
	return 'Linked pricing record';
}

export function groupConfigs(configs: InfraModelResponse[]): VersionedConfigRow[] {
	const grouped = new Map<string, InfraModelResponse[]>();

	for (const config of configs) {
		const versions = grouped.get(config.configKey ?? '') ?? [];
		versions.push(config);
		grouped.set(config.configKey ?? '', versions);
	}

	return Array.from(grouped.entries())
		.map(([configKey, versions]) => {
			const sorted = [...versions].sort(byCreatedDesc);
			const active = sorted.find((version) => version.isActive) ?? null;
			const latest = sorted[0];
			const current = active ?? latest;

			return {
				configKey,
				active,
				latest,
				versions: sorted,
				current,
				versionCount: sorted.length,
				providerLabel:
					current.expand?.provider?.displayName ??
					current.expand?.provider?.providerKey ??
					'Unknown',
				pricingLabel: labelForPricing(current.expand?.current_pricing)
			};
		})
		.sort((left, right) => left.configKey.localeCompare(right.configKey));
}

export function groupPrompts(prompts: AiPromptRow[]): VersionedPromptRow[] {
	const grouped = new Map<string, AiPromptRow[]>();

	for (const prompt of prompts) {
		const versions = grouped.get(prompt.promptKey ?? '') ?? [];
		versions.push(prompt);
		grouped.set(prompt.promptKey ?? '', versions);
	}

	return Array.from(grouped.entries())
		.map(([promptKey, versions]) => {
			const sorted = [...versions].sort((left, right) => {
				const versionDelta = (right.version ?? 0) - (left.version ?? 0);
				if (versionDelta !== 0) return versionDelta;
				return byCreatedDesc(left, right);
			});
			const active = sorted.find((version) => version.isActive) ?? null;
			const latest = sorted[0];
			const current = active ?? latest;

			return {
				promptKey,
				active,
				latest,
				versions: sorted,
				current,
				versionCount: sorted.length,
				preview: excerpt(current.promptTemplate ?? ''),
				lineCount: countLines(current.promptTemplate ?? '')
			};
		})
		.sort((left, right) => left.promptKey.localeCompare(right.promptKey));
}
