/**
 * Profile-scoped config helpers for the onboarding DO.
 * Extracted to a separate module so unit tests can import without
 * pulling in cloudflare: protocol dependencies from the DO file.
 */

import type {
	DisclosureConfig,
	DisclosureItem,
	OnboardingConfig,
	Question,
	ShowWhenCondition,
	ShowWhenRule
} from '../types/onboarding';
import { normalizeQuestionType } from '../services/onboarding-flow';

const DEFAULT_MAX_AI_QUESTIONS = 3;
const DEFAULT_SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function numberOrDefault(raw: string | null, fallback: number): number {
	if (raw == null) return fallback;
	const value = Number(raw);
	return Number.isFinite(value) ? value : fallback;
}

function parseOptions(raw: unknown): Array<{
	value: string;
	label: string;
	icon?: string;
	description?: string;
	grantsTags?: string[];
}> {
	if (!raw) return [];
	const normalize = (
		options: unknown[]
	): Array<{
		value: string;
		label: string;
		icon?: string;
		description?: string;
		grantsTags?: string[];
	}> =>
		options
			.filter(
				(option): option is Record<string, unknown> => Boolean(option) && typeof option === 'object'
			)
			.map((option) => ({
				value: String(option.value ?? ''),
				label: String(option.label ?? option.value ?? ''),
				...(typeof option.icon === 'string' ? { icon: option.icon } : {}),
				...(typeof option.description === 'string' ? { description: option.description } : {}),
				...(Array.isArray(option.grantsTags)
					? {
							grantsTags: option.grantsTags.filter((tag): tag is string => typeof tag === 'string')
						}
					: {})
			}));
	if (typeof raw === 'string') {
		try {
			const parsed = JSON.parse(raw);
			return Array.isArray(parsed) ? normalize(parsed) : [];
		} catch {
			return [];
		}
	}
	if (Array.isArray(raw)) return normalize(raw);
	return [];
}

function parseAiFallbackQuestions(raw: unknown): Question[] {
	if (!Array.isArray(raw)) return [];
	return raw
		.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
		.map((item, index): Question | null => {
			const question = String(item.question ?? '').trim();
			const factKey = String(item.factKey ?? item.fact_key ?? '').trim();
			if (!question || !factKey) return null;

			const sidebarTitle = String(
				item.sidebarTitle ?? item.sidebar_title ?? item.factLabel ?? item.fact_label ?? question
			).trim();

			return {
				id: String(item.id ?? `fallback_${factKey || index + 1}`),
				question,
				type: normalizeQuestionType(String(item.type ?? 'text')),
				factKey,
				factLabel: String(item.factLabel ?? item.fact_label ?? sidebarTitle),
				sidebarTitle,
				description:
					typeof item.description === 'string' && item.description.trim()
						? item.description.trim()
						: undefined,
				options: parseOptions(item.options),
				required: typeof item.required === 'boolean' ? item.required : true,
				group: typeof item.group === 'string' && item.group.trim() ? item.group.trim() : undefined
			};
		})
		.filter((item): item is Question => Boolean(item));
}

function parseTags(raw: unknown): string[] {
	if (!Array.isArray(raw)) return [];
	return [
		...new Set(
			raw
				.filter((tag): tag is string => typeof tag === 'string')
				.map((tag) => tag.trim())
				.filter(Boolean)
		)
	];
}

function parseVisibility(raw: unknown): 'public' | 'invite_only' | 'hidden' {
	return raw === 'invite_only' || raw === 'hidden' ? raw : 'public';
}

function parseDisclosures(raw: unknown): DisclosureConfig | undefined {
	if (!raw || typeof raw !== 'object') return undefined;
	const obj = raw as Record<string, unknown>;
	if (!obj.enabled) return undefined;
	if (!Array.isArray(obj.items) || obj.items.length === 0) return undefined;
	return {
		enabled: true,
		items: obj.items
			.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
			.map((item): DisclosureItem => {
				const title =
					typeof item.title === 'string' && item.title.trim() ? item.title.trim() : undefined;
				const body =
					typeof item.body === 'string' && item.body.trim() ? item.body.trim() : undefined;
				const acceptLabel =
					typeof item.acceptLabel === 'string' && item.acceptLabel.trim()
						? item.acceptLabel.trim()
						: undefined;
				const rejectLabel =
					typeof item.rejectLabel === 'string' && item.rejectLabel.trim()
						? item.rejectLabel.trim()
						: undefined;
				const rejectMessage =
					typeof item.rejectMessage === 'string' && item.rejectMessage.trim()
						? item.rejectMessage.trim()
						: undefined;

				return {
					id: String(item.id ?? ''),
					question: String(item.question ?? title ?? ''),
					...(title ? { title } : {}),
					...(body ? { body } : {}),
					type: item.type === 'accept_deny' ? 'accept_deny' : 'acknowledgement',
					required: item.required !== false,
					...(acceptLabel ? { acceptLabel } : {}),
					...(rejectLabel ? { rejectLabel } : {}),
					...(rejectMessage ? { rejectMessage } : {})
				};
			})
			.filter((item) => item.question)
	};
}

function normalizeShowWhen(raw: unknown): ShowWhenRule | undefined {
	if (!raw || typeof raw !== 'object') return undefined;
	const operatorMap: Record<string, ShowWhenCondition['operator']> = {
		eq: 'equals',
		neq: 'not_equals',
		in: 'includes_any',
		exists: 'exists',
		not_exists: 'not_exists',
		equals: 'equals',
		not_equals: 'not_equals',
		includes: 'includes',
		includes_any: 'includes_any'
	};
	const normalizeCondition = (condition: unknown): ShowWhenCondition | null => {
		if (!condition || typeof condition !== 'object') return null;
		const record = condition as Record<string, unknown>;
		const factKey = typeof record.factKey === 'string' ? record.factKey : undefined;
		const questionId = typeof record.questionId === 'string' ? record.questionId : undefined;
		if (!factKey && !questionId) return null;
		const operator = operatorMap[String(record.operator ?? 'equals')] ?? 'equals';
		return {
			...(factKey ? { factKey } : {}),
			...(questionId ? { questionId } : {}),
			operator,
			...(record.value !== undefined ? { value: record.value as ShowWhenCondition['value'] } : {})
		};
	};
	const record = raw as Record<string, unknown>;
	if (Array.isArray(record.all) || Array.isArray(record.any)) {
		const rule: ShowWhenRule = {};
		if (Array.isArray(record.all)) {
			rule.all = record.all
				.map(normalizeCondition)
				.filter((item): item is ShowWhenCondition => !!item);
		}
		if (Array.isArray(record.any)) {
			rule.any = record.any
				.map(normalizeCondition)
				.filter((item): item is ShowWhenCondition => !!item);
		}
		return rule;
	}
	const condition = normalizeCondition(raw);
	return condition ? { all: [condition] } : undefined;
}

/**
 * Maps a profile DB row (with joined model/provider) to the OnboardingConfig shape.
 */
export function buildProfileConfig(row: {
	profile: {
		id: string;
		systemPrompt: string | null;
		maxAiQuestions: string | null;
		sessionTimeoutMs: string | null;
		cacheTtlMs: string | null;
		model: string | null;
		defaultTags?: unknown;
		visibility?: string | null;
		aiFallbackQuestions?: unknown;
		disclosures?: unknown;
	};
	prompt: { promptTemplate: string | null } | null;
	model: { modelId: string | null; id: string } | null;
	provider: { providerKey: string | null } | null;
}): OnboardingConfig {
	const disclosures = parseDisclosures(row.profile.disclosures);

	return {
		id: row.profile.id,
		system_prompt: row.profile.systemPrompt ?? '',
		model: row.profile.model ?? '',
		max_ai_questions: numberOrDefault(row.profile.maxAiQuestions, DEFAULT_MAX_AI_QUESTIONS),
		session_timeout_ms: numberOrDefault(row.profile.sessionTimeoutMs, DEFAULT_SESSION_TIMEOUT_MS),
		cache_ttl_ms: numberOrDefault(row.profile.cacheTtlMs, DEFAULT_CACHE_TTL_MS),
		enabled: true,
		defaultTags: parseTags(row.profile.defaultTags),
		visibility: parseVisibility(row.profile.visibility),
		...(disclosures ? { disclosures } : {}),
		...(parseAiFallbackQuestions(row.profile.aiFallbackQuestions).length > 0
			? { aiFallbackQuestions: parseAiFallbackQuestions(row.profile.aiFallbackQuestions) }
			: {}),
		promptTemplate: row.prompt?.promptTemplate ?? null,
		modelId: row.model?.modelId ?? null,
		providerKey: (row.provider?.providerKey as OnboardingConfig['providerKey']) ?? null
	};
}

/**
 * Maps raw profile question DB rows to Question objects.
 */
export function buildProfileQuestions(
	rows: Array<{
		id: string;
		question: string | null;
		type: string | null;
		factKey: string | null;
		description: string | null;
		sidebarTitle: string | null;
		options: unknown;
		order: string | number | null;
		enabled: boolean | null;
		required: boolean | null;
		showWhen: unknown | null;
		group: string | null;
		metadata: unknown | null;
	}>
): Question[] {
	return rows
		.filter((r) => r.enabled !== false)
		.map((r) => ({
			id: r.id,
			question: r.question ?? '',
			type: normalizeQuestionType(r.type),
			factKey: r.factKey ?? r.id,
			factLabel: r.sidebarTitle ?? r.question ?? '',
			sidebarTitle: r.sidebarTitle ?? '',
			description: r.description ?? undefined,
			options: parseOptions(r.options),
			required: r.required ?? true,
			showWhen: normalizeShowWhen(r.showWhen),
			group: r.group ?? undefined,
			metadata: (r.metadata as any) ?? undefined
		}));
}
