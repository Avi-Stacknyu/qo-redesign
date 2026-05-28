import { query, command, getRequestEvent } from '$app/server';
import z from 'zod/v4';
import {
	aiAgentModels,
	aiPrompts,
	configOnboardingCampaigns,
	configOnboardingInviteCodes,
	configOnboardingProfiles,
	configOnboardingProfileQuestions,
	configTagCatalog,
	configTagNamespaces,
	userOnboardingAssignments
} from '@repo/db/schema';
import { and, asc, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { generateId } from '@repo/db/id';
import {
	buildStrictOnboardingMarkdownExport,
	buildCompilerPrompt,
	compileStrictOnboardingMarkdown,
	validateCompilerOutput,
	type CompilerOutput,
	type ExportableStrictOnboardingProfile
} from './compiler';

function slugify(value: string): string {
	return value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80);
}

function normalizeOptionalText(value: string | null | undefined): string | null {
	const trimmed = value?.trim() ?? '';
	return trimmed ? trimmed : null;
}

function parseJsonText(value: string | null | undefined, fallback: unknown) {
	const trimmed = value?.trim() ?? '';
	if (!trimmed) return fallback;
	return JSON.parse(trimmed) as unknown;
}

function normalizeTags(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return [
		...new Set(
			value
				.filter((tag): tag is string => typeof tag === 'string')
				.map((tag) => tag.trim().toLowerCase())
				.filter((tag) => /^[a-z][a-z0-9_-]*:[a-z0-9][a-z0-9_-]*$/.test(tag))
		)
	];
}

type StoredDisclosureConfig = NonNullable<CompilerOutput['disclosures']>;
type StoredDisclosureItem = StoredDisclosureConfig['items'][number];

function disclosureKey(value: string, fallback: string): string {
	const key = value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.slice(0, 80);
	return key || fallback;
}

function disclosureQuestionFromTitle(title: string): string {
	const normalizedTitle = title.trim();
	if (!normalizedTitle) return 'I agree to the disclosure.';
	if (/^i\b/i.test(normalizedTitle)) return normalizedTitle;
	return `I agree to the ${normalizedTitle}.`;
}

function normalizeDisclosureItem(value: unknown, index: number): StoredDisclosureItem | null {
	if (!value || typeof value !== 'object') return null;
	const record = value as Record<string, unknown>;
	const title =
		typeof record.title === 'string' && record.title.trim() ? record.title.trim() : undefined;
	const body =
		typeof record.body === 'string' && record.body.trim() ? record.body.trim() : undefined;
	const question =
		typeof record.question === 'string' && record.question.trim()
			? record.question.trim()
			: title
				? disclosureQuestionFromTitle(title)
				: '';
	if (!question) return null;

	const acceptLabel =
		typeof record.acceptLabel === 'string' && record.acceptLabel.trim()
			? record.acceptLabel.trim()
			: undefined;
	const rejectLabel =
		typeof record.rejectLabel === 'string' && record.rejectLabel.trim()
			? record.rejectLabel.trim()
			: undefined;
	const rejectMessage =
		typeof record.rejectMessage === 'string' && record.rejectMessage.trim()
			? record.rejectMessage.trim()
			: undefined;

	return {
		id:
			typeof record.id === 'string' && record.id.trim()
				? record.id.trim()
				: disclosureKey(title || question, `disclosure_${index + 1}`),
		question,
		...(title ? { title } : {}),
		...(body ? { body } : {}),
		type: record.type === 'accept_deny' ? 'accept_deny' : 'acknowledgement',
		required: record.required !== false,
		...(acceptLabel ? { acceptLabel } : {}),
		...(rejectLabel ? { rejectLabel } : {}),
		...(rejectMessage ? { rejectMessage } : {})
	};
}

function parseStoredDisclosures(raw: unknown): StoredDisclosureConfig | undefined {
	if (!raw || typeof raw !== 'object') return undefined;
	const record = raw as Record<string, unknown>;
	const items = Array.isArray(record.items)
		? record.items
				.map((item, index) => normalizeDisclosureItem(item, index))
				.filter((item): item is StoredDisclosureItem => item !== null)
		: [];
	if (items.length === 0) return undefined;
	return {
		enabled: typeof record.enabled === 'boolean' ? record.enabled : items.length > 0,
		items
	};
}

type ExportQuestion = ExportableStrictOnboardingProfile['questions'][number];
type ExportFallbackQuestion = NonNullable<
	NonNullable<ExportableStrictOnboardingProfile['aiFallbackQuestions']>
>[number];
type ExportQuestionType = CompilerOutput['questions'][number]['type'];
type ExportShowWhen = ExportQuestion['showWhen'];
type ExportShowWhenCondition = Extract<NonNullable<ExportShowWhen>, { operator: unknown }>;
type ExportCompositeShowWhen = Exclude<NonNullable<ExportShowWhen>, ExportShowWhenCondition>;
type ExportCompositeCondition = NonNullable<ExportCompositeShowWhen['all']>[number];

function normalizeExportQuestionType(value: unknown): ExportQuestionType {
	const normalized =
		typeof value === 'string'
			? value
					.trim()
					.toLowerCase()
					.replace(/[\s-]+/g, '_')
			: '';
	if (
		normalized === 'single_select' ||
		normalized === 'multi_select' ||
		normalized === 'text' ||
		normalized === 'number' ||
		normalized === 'boolean'
	) {
		return normalized;
	}
	return 'text';
}

function normalizeExportShowWhenOperator(value: unknown): ExportShowWhenCondition['operator'] {
	switch (value) {
		case 'eq':
		case 'equals':
			return 'equals';
		case 'neq':
		case 'not_equals':
			return 'not_equals';
		case 'in':
		case 'includes_any':
			return 'includes_any';
		case 'includes':
			return 'includes';
		case 'exists':
			return 'exists';
		case 'not_exists':
			return 'not_exists';
		default:
			return 'equals';
	}
}

function normalizeExportCompositeOperator(value: unknown): ExportCompositeCondition['operator'] {
	const operator = normalizeExportShowWhenOperator(value);
	return operator === 'includes_any' || operator === 'includes'
		? operator
		: operator === 'exists' ||
			  operator === 'not_exists' ||
			  operator === 'equals' ||
			  operator === 'not_equals'
			? operator
			: 'equals';
}

function normalizeExportConditionValue(value: unknown): string | string[] | undefined {
	if (typeof value === 'string') return value;
	if (!Array.isArray(value)) return undefined;
	const items = value.filter((item): item is string => typeof item === 'string');
	return items.length > 0 ? items : undefined;
}

function normalizeExportCompositeCondition(value: unknown): ExportCompositeCondition | null {
	if (!value || typeof value !== 'object') return null;
	const record = value as Record<string, unknown>;
	const factKey = typeof record.factKey === 'string' ? record.factKey : undefined;
	const questionId = typeof record.questionId === 'string' ? record.questionId : undefined;
	if (!factKey && !questionId) return null;
	const normalizedValue = normalizeExportConditionValue(record.value);
	return {
		...(factKey ? { factKey } : {}),
		...(questionId ? { questionId } : {}),
		operator: normalizeExportCompositeOperator(record.operator),
		...(normalizedValue !== undefined ? { value: normalizedValue } : {})
	};
}

function normalizeExportShowWhen(value: unknown): ExportShowWhen | undefined {
	if (!value || typeof value !== 'object') return undefined;
	const record = value as Record<string, unknown>;
	if (typeof record.operator === 'string') {
		const factKey = typeof record.factKey === 'string' ? record.factKey : undefined;
		const questionId = typeof record.questionId === 'string' ? record.questionId : undefined;
		if (!factKey && !questionId) return undefined;
		const normalizedValue = normalizeExportConditionValue(record.value);
		if (!factKey && questionId) {
			return {
				all: [
					{
						questionId,
						operator: normalizeExportCompositeOperator(record.operator),
						...(normalizedValue !== undefined ? { value: normalizedValue } : {})
					}
				]
			};
		}
		return {
			factKey: factKey!,
			operator: normalizeExportShowWhenOperator(record.operator),
			...(normalizedValue !== undefined ? { value: normalizedValue } : {})
		};
	}

	const all = Array.isArray(record.all)
		? record.all
				.map(normalizeExportCompositeCondition)
				.filter((condition): condition is ExportCompositeCondition => condition !== null)
		: [];
	const any = Array.isArray(record.any)
		? record.any
				.map(normalizeExportCompositeCondition)
				.filter((condition): condition is ExportCompositeCondition => condition !== null)
		: [];

	if (all.length === 0 && any.length === 0) return undefined;

	return {
		...(all.length > 0 ? { all } : {}),
		...(any.length > 0 ? { any } : {})
	};
}

function normalizeExportOptions(value: unknown): ExportQuestion['options'] {
	if (!Array.isArray(value)) return undefined;
	const options = value
		.map((option) => {
			if (!option || typeof option !== 'object') return null;
			const record = option as Record<string, unknown>;
			if (typeof record.label !== 'string' || typeof record.value !== 'string') return null;
			const grantsTags = Array.isArray(record.grantsTags)
				? record.grantsTags.filter((tag): tag is string => typeof tag === 'string')
				: undefined;
			return {
				label: record.label,
				value: record.value,
				...(grantsTags && grantsTags.length > 0 ? { grantsTags } : {})
			};
		})
		.filter((option): option is NonNullable<ExportQuestion['options']>[number] => option !== null);
	return options.length > 0 ? options : undefined;
}

function normalizeShowWhen(value: unknown): unknown {
	if (!value || typeof value !== 'object') return null;
	const normalizeOperator = (operator: unknown) => {
		if (operator === 'eq') return 'equals';
		if (operator === 'neq') return 'not_equals';
		if (operator === 'in') return 'includes_any';
		return typeof operator === 'string' ? operator : 'equals';
	};
	const normalizeCondition = (condition: unknown) => {
		if (!condition || typeof condition !== 'object') return null;
		const record = condition as Record<string, unknown>;
		const factKey = typeof record.factKey === 'string' ? record.factKey : undefined;
		const questionId = typeof record.questionId === 'string' ? record.questionId : undefined;
		if (!factKey && !questionId) return null;
		return {
			...(factKey ? { factKey } : {}),
			...(questionId ? { questionId } : {}),
			operator: normalizeOperator(record.operator),
			...(record.value !== undefined ? { value: record.value } : {})
		};
	};
	const record = value as Record<string, unknown>;
	if (Array.isArray(record.all) || Array.isArray(record.any)) {
		return {
			...(Array.isArray(record.all)
				? { all: record.all.map(normalizeCondition).filter(Boolean) }
				: {}),
			...(Array.isArray(record.any)
				? { any: record.any.map(normalizeCondition).filter(Boolean) }
				: {})
		};
	}
	const condition = normalizeCondition(value);
	return condition ? { all: [condition] } : null;
}

const aiFallbackQuestionSchema = z.object({
	id: z.string().min(1),
	question: z.string().min(1),
	type: z.enum(['single_select', 'multi_select', 'text', 'number', 'boolean']),
	factKey: z.string().min(1),
	factLabel: z.string().min(1),
	sidebarTitle: z.string().min(1),
	description: z.string().optional(),
	options: z
		.array(
			z.object({
				label: z.string(),
				value: z.string(),
				grantsTags: z.array(z.string()).optional()
			})
		)
		.optional(),
	required: z.boolean(),
	group: z.string().optional()
});

async function getActiveModelOptions(db: App.Locals['db']) {
	return await db
		.select({
			id: aiAgentModels.id,
			displayName: aiAgentModels.displayName,
			modelId: aiAgentModels.modelId
		})
		.from(aiAgentModels)
		.where(
			and(
				eq(aiAgentModels.isActive, true),
				eq(aiAgentModels.isEnabled, true),
				or(eq(aiAgentModels.configKey, ''), isNull(aiAgentModels.configKey))
			)
		)
		.orderBy(asc(aiAgentModels.displayName));
}

async function getTagOptions(db: App.Locals['db']) {
	const rows = await db
		.select({
			id: configTagCatalog.id,
			tag: configTagCatalog.tag,
			namespace: configTagNamespaces.name,
			namespaceLabel: configTagNamespaces.displayName
		})
		.from(configTagCatalog)
		.leftJoin(configTagNamespaces, eq(configTagCatalog.namespace, configTagNamespaces.id))
		.orderBy(
			asc(configTagNamespaces.sortOrder),
			asc(configTagNamespaces.name),
			asc(configTagCatalog.tag)
		);

	return rows
		.map((row) => {
			const namespace = row.namespace?.trim();
			const tag = row.tag?.trim();
			if (!namespace || !tag) return null;
			const value = `${namespace}:${tag}`.toLowerCase();
			return {
				id: row.id,
				value,
				label: `${row.namespaceLabel ?? namespace}: ${tag}`
			};
		})
		.filter((option): option is { id: string; value: string; label: string } => Boolean(option));
}

async function getTagTaxonomy(db: App.Locals['db']): Promise<string[]> {
	return (await getTagOptions(db)).map((option) => option.value);
}

// ============================================================================
// Queries
// ============================================================================

export const getOnboardingProfiles = query(async () => {
	const { locals } = getRequestEvent();
	const db = locals.db;

	const profiles = await db
		.select()
		.from(configOnboardingProfiles)
		.orderBy(desc(configOnboardingProfiles.updated));

	const profilesWithCounts = await Promise.all(
		profiles.map(async (p) => {
			const questions = await db
				.select({ id: configOnboardingProfileQuestions.id })
				.from(configOnboardingProfileQuestions)
				.where(eq(configOnboardingProfileQuestions.profile, p.id));
			return { ...p, questionCount: questions.length };
		})
	);

	return { profiles: profilesWithCounts };
});

export const getProfileImportOptions = query(async () => {
	const { locals } = getRequestEvent();
	const db = locals.db;

	return {
		modelOptions: await getActiveModelOptions(db)
	};
});

export const getProfileById = query(z.object({ id: z.string() }), async ({ id }) => {
	const { locals } = getRequestEvent();
	const db = locals.db;

	const profile = await db
		.select()
		.from(configOnboardingProfiles)
		.where(eq(configOnboardingProfiles.id, id))
		.then((rows) => rows[0] ?? null);

	if (!profile) return { error: 'Profile not found' as const };

	const questions = await db
		.select()
		.from(configOnboardingProfileQuestions)
		.where(eq(configOnboardingProfileQuestions.profile, id))
		.orderBy(asc(configOnboardingProfileQuestions.order));

	const campaigns = await db
		.select()
		.from(configOnboardingCampaigns)
		.where(eq(configOnboardingCampaigns.defaultProfile, id))
		.orderBy(desc(configOnboardingCampaigns.updated));

	const campaignIds = campaigns.map((campaign) => campaign.id);
	const inviteCodes = campaignIds.length
		? await db
				.select()
				.from(configOnboardingInviteCodes)
				.where(inArray(configOnboardingInviteCodes.campaign, campaignIds))
				.orderBy(desc(configOnboardingInviteCodes.updated))
		: [];

	const [modelOptions, tagOptions] = await Promise.all([
		getActiveModelOptions(db),
		getTagOptions(db)
	]);

	const promptOptions = await db
		.select({
			id: aiPrompts.id,
			displayName: aiPrompts.displayName,
			promptKey: aiPrompts.promptKey,
			category: aiPrompts.category
		})
		.from(aiPrompts)
		.where(eq(aiPrompts.isActive, true))
		.orderBy(asc(aiPrompts.displayName));

	const selectedPrompt = profile.systemPrompt
		? await db
				.select({
					id: aiPrompts.id,
					displayName: aiPrompts.displayName,
					promptKey: aiPrompts.promptKey,
					promptTemplate: aiPrompts.promptTemplate
				})
				.from(aiPrompts)
				.where(eq(aiPrompts.id, profile.systemPrompt))
				.then((rows) => rows[0] ?? null)
		: null;

	const disclosures = parseStoredDisclosures(profile.disclosures);

	return {
		profile: {
			...profile,
			disclosures: disclosures ?? null
		},
		questions,
		campaigns: campaigns.map((campaign) => ({
			...campaign,
			inviteCodes: inviteCodes.filter((code) => code.campaign === campaign.id)
		})),
		modelOptions,
		tagOptions,
		promptOptions,
		selectedPrompt
	};
});

export const getProfileMarkdownExport = query(z.object({ id: z.string() }), async ({ id }) => {
	const { locals } = getRequestEvent();
	const db = locals.db;

	const profile = await db
		.select()
		.from(configOnboardingProfiles)
		.where(eq(configOnboardingProfiles.id, id))
		.then((rows) => rows[0] ?? null);

	if (!profile) return { error: 'Profile not found' as const };

	const questions = await db
		.select()
		.from(configOnboardingProfileQuestions)
		.where(eq(configOnboardingProfileQuestions.profile, id))
		.orderBy(asc(configOnboardingProfileQuestions.order));

	const promptTemplate = profile.systemPrompt
		? await db
				.select({ promptTemplate: aiPrompts.promptTemplate })
				.from(aiPrompts)
				.where(eq(aiPrompts.id, profile.systemPrompt))
				.then((rows) => rows[0]?.promptTemplate ?? null)
		: null;
	const disclosures = parseStoredDisclosures(profile.disclosures);

	const exportQuestions: ExportableStrictOnboardingProfile['questions'] = questions.map(
		(question, index): ExportQuestion => {
			const options = normalizeExportOptions(question.options);
			const showWhen = normalizeExportShowWhen(question.showWhen);
			return {
				question: question.question ?? 'Untitled question',
				type: normalizeExportQuestionType(question.type),
				factKey: question.factKey ?? `question_${index + 1}`,
				order: Number(question.order ?? index + 1),
				required: question.required ?? true,
				enabled: question.enabled ?? true,
				...(question.description ? { description: question.description } : {}),
				...(question.sidebarTitle ? { sidebarTitle: question.sidebarTitle } : {}),
				...(options ? { options } : {}),
				...(showWhen ? { showWhen } : {}),
				...(question.group ? { group: question.group } : {})
			};
		}
	);

	const exportFallbackQuestions: ExportableStrictOnboardingProfile['aiFallbackQuestions'] =
		Array.isArray(profile.aiFallbackQuestions)
			? profile.aiFallbackQuestions
					.map((question, index) => {
						if (!question || typeof question !== 'object') return null;
						const record = question as Record<string, unknown>;
						const options = normalizeExportOptions(record.options);
						const fallbackQuestion: ExportFallbackQuestion = {
							id:
								typeof record.id === 'string' && record.id.trim().length > 0
									? record.id
									: `fallback_question_${index + 1}`,
							question:
								typeof record.question === 'string' && record.question.trim().length > 0
									? record.question
									: 'Untitled fallback question',
							type: normalizeExportQuestionType(record.type),
							factKey:
								typeof record.factKey === 'string' && record.factKey.trim().length > 0
									? record.factKey
									: `fallback_question_${index + 1}`,
							factLabel:
								typeof record.factLabel === 'string' && record.factLabel.trim().length > 0
									? record.factLabel
									: typeof record.question === 'string' && record.question.trim().length > 0
										? record.question
										: 'Fallback Question',
							sidebarTitle:
								typeof record.sidebarTitle === 'string' && record.sidebarTitle.trim().length > 0
									? record.sidebarTitle
									: typeof record.factLabel === 'string' && record.factLabel.trim().length > 0
										? record.factLabel
										: typeof record.question === 'string' && record.question.trim().length > 0
											? record.question
											: 'Fallback Question',
							required: typeof record.required === 'boolean' ? record.required : true,
							...(typeof record.description === 'string'
								? { description: record.description }
								: {}),
							...(options ? { options } : {}),
							...(typeof record.group === 'string' ? { group: record.group } : {})
						};
						return fallbackQuestion;
					})
					.filter((question): question is ExportFallbackQuestion => question !== null)
			: undefined;

	const markdown = buildStrictOnboardingMarkdownExport({
		name: profile.name,
		key: profile.key,
		description: profile.description,
		industryKey: profile.industryKey,
		status: profile.status,
		visibility: profile.visibility,
		defaultTags: Array.isArray(profile.defaultTags) ? (profile.defaultTags as string[]) : [],
		runtimeModel: profile.model,
		maxAiQuestions: profile.maxAiQuestions === null ? null : Number(profile.maxAiQuestions),
		sessionTimeoutMs: profile.sessionTimeoutMs === null ? null : Number(profile.sessionTimeoutMs),
		cacheTtlMs: profile.cacheTtlMs === null ? null : Number(profile.cacheTtlMs),
		enableTrialActivation: profile.enableTrialActivation,
		disclosures,
		promptTemplate,
		questions: exportQuestions,
		aiFallbackQuestions: exportFallbackQuestions
	});

	return {
		markdown,
		fileName: `${profile.key || slugify(profile.name)}.md`
	};
});

// ============================================================================
// Commands
// ============================================================================

export const generateProfileFromMarkdown = command(
	z.object({
		markdown: z.string().min(1),
		generationModelId: z.string().optional(),
		runtimeModelId: z.string().optional(),
		modelOverride: z.string().optional()
	}),
	async ({ markdown, generationModelId, runtimeModelId, modelOverride }) => {
		const { locals, platform } = getRequestEvent();
		const db = locals.db;

		try {
			if (markdown.length > 200_000) {
				return { error: 'Markdown is too large. Keep the source under 200,000 characters.' };
			}

			let importMode: 'strict' | 'ai' = 'strict';
			let compiled = compileStrictOnboardingMarkdown(markdown);

			if (!compiled) {
				const selectedGenerationModel = normalizeOptionalText(generationModelId);
				if (!selectedGenerationModel) {
					return {
						error:
							'This markdown does not match the strict import template. Select a generation model to use AI fallback.'
					};
				}
				if (!platform?.env?.CF_WORKER) {
					return { error: 'AI fallback is not available in this environment.' };
				}

				const prompt = buildCompilerPrompt({
					markdown,
					schemaSections: [],
					tagTaxonomy: await getTagTaxonomy(db)
				});
				const aiResult = await platform.env.CF_WORKER.generateOnboardingProfileConfig({
					modelId: selectedGenerationModel,
					system: prompt.system,
					context: prompt.context,
					user: prompt.user
				});

				if (!aiResult.success) {
					return {
						error: aiResult.error ?? 'AI fallback could not generate an onboarding profile.'
					};
				}

				compiled = aiResult.output as ReturnType<typeof compileStrictOnboardingMarkdown>;
				importMode = 'ai';
			}

			const validated = validateCompilerOutput(compiled);
			if (!validated.success) {
				return { error: 'Could not turn this markdown into a valid onboarding profile.' };
			}

			const explicitKey =
				importMode === 'strict' ? normalizeOptionalText(validated.data.summary.key) : null;
			const normalizedExplicitKey = explicitKey ? slugify(explicitKey) : null;
			const existingProfile = normalizedExplicitKey
				? await db
						.select()
						.from(configOnboardingProfiles)
						.where(eq(configOnboardingProfiles.key, normalizedExplicitKey))
						.then((rows) => rows[0] ?? null)
				: null;

			const runtimeModelInput =
				runtimeModelId ?? validated.data.summary.runtimeModel ?? modelOverride;
			const runtimeModel =
				runtimeModelInput !== undefined
					? normalizeOptionalText(runtimeModelInput)
					: (existingProfile?.model ?? null);

			const now = new Date().toISOString();
			const profileId = existingProfile?.id ?? generateId();
			const promptId = existingProfile?.systemPrompt ?? generateId();
			const baseKey =
				normalizedExplicitKey ||
				slugify(validated.data.summary.industryKey || validated.data.summary.name);
			let key = baseKey || `profile-${profileId.slice(0, 8)}`;
			let suffix = 2;

			if (!existingProfile) {
				while (
					await db
						.select({ id: configOnboardingProfiles.id })
						.from(configOnboardingProfiles)
						.where(eq(configOnboardingProfiles.key, key))
						.then((rows) => rows[0] ?? null)
				) {
					key = `${baseKey}-${suffix}`;
					suffix += 1;
				}
			}

			const nextStatus =
				validated.data.summary.status ??
				(existingProfile?.status as 'draft' | 'active' | 'archived' | null | undefined) ??
				'draft';

			await db.transaction(async (tx) => {
				if (existingProfile?.systemPrompt) {
					await tx
						.update(aiPrompts)
						.set({
							displayName: `${validated.data.summary.name} Prompt`,
							description: `Generated onboarding prompt for ${validated.data.summary.name}`,
							promptTemplate: validated.data.runtimePrompt,
							updated: now
						})
						.where(eq(aiPrompts.id, promptId));
				} else {
					await tx.insert(aiPrompts).values({
						id: promptId,
						promptKey: `onboarding_profile_${key}`,
						category: 'onboarding',
						displayName: `${validated.data.summary.name} Prompt`,
						description: `Generated onboarding prompt for ${validated.data.summary.name}`,
						promptTemplate: validated.data.runtimePrompt,
						isActive: true,
						version: 1,
						created: now,
						updated: now
					});
				}

				type ProfileInsert = typeof configOnboardingProfiles.$inferInsert;
				const disclosures = parseStoredDisclosures(validated.data.disclosures);
				const profilePayload: Omit<ProfileInsert, 'id' | 'created'> = {
					key,
					name: validated.data.summary.name,
					description: validated.data.summary.description,
					industryKey: validated.data.summary.industryKey,
					status: nextStatus,
					isActive: nextStatus === 'active',
					model: runtimeModel,
					systemPrompt: promptId,
					maxAiQuestions: String(validated.data.summary.maxAiQuestions),
					defaultTags: normalizeTags(validated.data.summary.defaultTags),
					visibility: validated.data.summary.visibility ?? existingProfile?.visibility ?? 'public',
					disclosures: disclosures ?? null,
					aiFallbackQuestions: validated.data.aiFallbackQuestions ?? [],
					updated: now
				};

				if (validated.data.summary.sessionTimeoutMs !== undefined) {
					profilePayload.sessionTimeoutMs =
						validated.data.summary.sessionTimeoutMs === null
							? null
							: String(validated.data.summary.sessionTimeoutMs);
				} else if (!existingProfile) {
					profilePayload.sessionTimeoutMs = null;
				}

				if (validated.data.summary.cacheTtlMs !== undefined) {
					profilePayload.cacheTtlMs =
						validated.data.summary.cacheTtlMs === null
							? null
							: String(validated.data.summary.cacheTtlMs);
				} else if (!existingProfile) {
					profilePayload.cacheTtlMs = null;
				}

				if (validated.data.summary.enableTrialActivation !== undefined) {
					profilePayload.enableTrialActivation = validated.data.summary.enableTrialActivation;
				} else if (!existingProfile) {
					profilePayload.enableTrialActivation = true;
				}

				if (existingProfile) {
					await tx
						.update(configOnboardingProfiles)
						.set(profilePayload)
						.where(eq(configOnboardingProfiles.id, profileId));
					await tx
						.delete(configOnboardingProfileQuestions)
						.where(eq(configOnboardingProfileQuestions.profile, profileId));
				} else {
					const insertPayload: ProfileInsert = {
						id: profileId,
						...profilePayload,
						created: now
					};
					await tx.insert(configOnboardingProfiles).values(insertPayload);
				}

				await tx.insert(configOnboardingProfileQuestions).values(
					validated.data.questions.map((question) => ({
						id: generateId(),
						profile: profileId,
						question: question.question,
						type: question.type,
						description: normalizeOptionalText(question.description),
						sidebarTitle: normalizeOptionalText(question.sidebarTitle),
						factKey: question.factKey,
						options: question.options ?? [],
						order: String(question.order),
						enabled: question.enabled ?? true,
						required: question.required,
						showWhen: normalizeShowWhen(question.showWhen),
						group: normalizeOptionalText(question.group),
						metadata: { suggestedTags: validated.data.suggestedTags },
						created: now,
						updated: now
					}))
				);
			});

			void getOnboardingProfiles().refresh();
			void getProfileById({ id: profileId }).refresh();
			return {
				profileId,
				importMode,
				action: existingProfile ? 'updated' : 'created'
			};
		} catch (e) {
			return { error: (e as Error).message };
		}
	}
);

export const publishProfile = command(z.object({ id: z.string().min(1) }), async ({ id }) => {
	const { locals } = getRequestEvent();
	const db = locals.db;

	try {
		const existing = await db
			.select()
			.from(configOnboardingProfiles)
			.where(eq(configOnboardingProfiles.id, id))
			.then((rows) => rows[0] ?? null);

		if (!existing) return { success: false, error: 'Profile not found' };
		if (existing.status === 'active') return { success: false, error: 'Profile is already active' };
		if (existing.status !== 'draft' && existing.status !== 'archived') {
			return { success: false, error: 'Only draft or archived profiles can be published' };
		}

		await db
			.update(configOnboardingProfiles)
			.set({ status: 'active', isActive: true, updated: new Date().toISOString() })
			.where(eq(configOnboardingProfiles.id, id));

		void getOnboardingProfiles().refresh();
		void getProfileById({ id }).refresh();
		return { success: true };
	} catch (e) {
		return { success: false, error: (e as Error).message };
	}
});

export const archiveProfile = command(z.object({ id: z.string().min(1) }), async ({ id }) => {
	const { locals } = getRequestEvent();
	const db = locals.db;

	try {
		const existing = await db
			.select()
			.from(configOnboardingProfiles)
			.where(eq(configOnboardingProfiles.id, id))
			.then((rows) => rows[0] ?? null);

		if (!existing) return { success: false, error: 'Profile not found' };
		if (existing.status !== 'active') {
			return { success: false, error: 'Only active profiles can be archived' };
		}

		await db
			.update(configOnboardingProfiles)
			.set({ status: 'archived', isActive: false, updated: new Date().toISOString() })
			.where(eq(configOnboardingProfiles.id, id));

		void getOnboardingProfiles().refresh();
		void getProfileById({ id }).refresh();
		return { success: true };
	} catch (e) {
		return { success: false, error: (e as Error).message };
	}
});

export const revertToDraft = command(z.object({ id: z.string().min(1) }), async ({ id }) => {
	const { locals } = getRequestEvent();
	const db = locals.db;

	try {
		const existing = await db
			.select()
			.from(configOnboardingProfiles)
			.where(eq(configOnboardingProfiles.id, id))
			.then((rows) => rows[0] ?? null);

		if (!existing) return { success: false, error: 'Profile not found' };
		if (existing.status !== 'active' && existing.status !== 'archived') {
			return { success: false, error: 'Only active or archived profiles can revert to draft' };
		}

		await db
			.update(configOnboardingProfiles)
			.set({ status: 'draft', isActive: false, updated: new Date().toISOString() })
			.where(eq(configOnboardingProfiles.id, id));

		void getOnboardingProfiles().refresh();
		void getProfileById({ id }).refresh();
		return { success: true };
	} catch (e) {
		return { success: false, error: (e as Error).message };
	}
});

export const updateProfileMetadata = command(
	z.object({
		id: z.string().min(1),
		key: z.string().min(1).optional(),
		name: z.string().min(1).optional(),
		description: z.string().optional(),
		industryKey: z.string().optional(),
		model: z.string().nullable().optional(),
		systemPrompt: z.string().nullable().optional(),
		maxAiQuestions: z.number().int().min(0).max(20).nullable().optional(),
		sessionTimeoutMs: z.number().int().min(0).nullable().optional(),
		cacheTtlMs: z.number().int().min(0).nullable().optional(),
		enableTrialActivation: z.boolean().optional(),
		defaultTags: z.array(z.string()).optional(),
		visibility: z.enum(['public', 'invite_only', 'hidden']).optional(),
		aiFallbackQuestions: z.array(aiFallbackQuestionSchema).optional(),
		disclosures: z
			.object({
				enabled: z.boolean(),
				items: z.array(
					z.object({
						id: z.string().min(1),
						question: z.string().min(1),
						title: z.string().optional(),
						body: z.string().optional(),
						type: z.enum(['acknowledgement', 'accept_deny']),
						required: z.boolean(),
						acceptLabel: z.string().optional(),
						rejectLabel: z.string().optional(),
						rejectMessage: z.string().optional()
					})
				)
			})
			.optional()
	}),
	async ({ id, ...fields }) => {
		const { locals } = getRequestEvent();
		const db = locals.db;

		try {
			const existing = await db
				.select()
				.from(configOnboardingProfiles)
				.where(eq(configOnboardingProfiles.id, id))
				.then((rows) => rows[0] ?? null);

			if (!existing) return { success: false, error: 'Profile not found' };

			const payload: Record<string, unknown> = { updated: new Date().toISOString() };
			if (fields.key !== undefined) payload.key = fields.key.trim();
			if (fields.name !== undefined) payload.name = fields.name;
			if (fields.description !== undefined)
				payload.description = normalizeOptionalText(fields.description);
			if (fields.industryKey !== undefined)
				payload.industryKey = normalizeOptionalText(fields.industryKey);
			if (fields.model !== undefined) payload.model = normalizeOptionalText(fields.model);
			if (fields.systemPrompt !== undefined)
				payload.systemPrompt = normalizeOptionalText(fields.systemPrompt);
			if (fields.maxAiQuestions !== undefined)
				payload.maxAiQuestions =
					fields.maxAiQuestions === null ? null : String(fields.maxAiQuestions);
			if (fields.sessionTimeoutMs !== undefined)
				payload.sessionTimeoutMs =
					fields.sessionTimeoutMs === null ? null : String(fields.sessionTimeoutMs);
			if (fields.cacheTtlMs !== undefined)
				payload.cacheTtlMs = fields.cacheTtlMs === null ? null : String(fields.cacheTtlMs);
			if (fields.enableTrialActivation !== undefined)
				payload.enableTrialActivation = fields.enableTrialActivation;
			if (fields.defaultTags !== undefined) payload.defaultTags = normalizeTags(fields.defaultTags);
			if (fields.visibility !== undefined) payload.visibility = fields.visibility;
			if (fields.aiFallbackQuestions !== undefined)
				payload.aiFallbackQuestions = fields.aiFallbackQuestions;
			if (fields.disclosures !== undefined) {
				payload.disclosures = parseStoredDisclosures(fields.disclosures) ?? null;
			}

			await db
				.update(configOnboardingProfiles)
				.set(payload)
				.where(eq(configOnboardingProfiles.id, id));

			void getOnboardingProfiles().refresh();
			void getProfileById({ id }).refresh();
			return { success: true };
		} catch (e) {
			return { success: false, error: (e as Error).message };
		}
	}
);

export const saveProfilePromptTemplate = command(
	z.object({
		profileId: z.string().min(1),
		displayName: z.string().min(1),
		promptTemplate: z.string().min(1)
	}),
	async ({ profileId, displayName, promptTemplate }) => {
		const { locals } = getRequestEvent();
		const db = locals.db;
		const now = new Date().toISOString();

		try {
			const profile = await db
				.select()
				.from(configOnboardingProfiles)
				.where(eq(configOnboardingProfiles.id, profileId))
				.then((rows) => rows[0] ?? null);

			if (!profile) return { success: false, error: 'Profile not found' };

			const promptKey = `onboarding_profile_${slugify(profile.key || profile.id)}`;
			const currentPrompt = profile.systemPrompt
				? await db
						.select()
						.from(aiPrompts)
						.where(eq(aiPrompts.id, profile.systemPrompt))
						.then((rows) => rows[0] ?? null)
				: null;

			let promptId = currentPrompt?.promptKey === promptKey ? currentPrompt.id : null;
			if (!promptId) {
				const existingDedicatedPrompt = await db
					.select()
					.from(aiPrompts)
					.where(eq(aiPrompts.promptKey, promptKey))
					.then((rows) => rows[0] ?? null);
				promptId = existingDedicatedPrompt?.id ?? generateId();
				if (!existingDedicatedPrompt) {
					await db.insert(aiPrompts).values({
						id: promptId,
						promptKey,
						category: 'onboarding',
						displayName: displayName.trim(),
						description: `Profile-specific onboarding prompt for ${profile.name}`,
						promptTemplate,
						isActive: true,
						version: 1,
						created: now,
						updated: now
					});
				}
			}

			await db
				.update(aiPrompts)
				.set({ displayName: displayName.trim(), promptTemplate, updated: now })
				.where(eq(aiPrompts.id, promptId));

			await db
				.update(configOnboardingProfiles)
				.set({ systemPrompt: promptId, updated: now })
				.where(eq(configOnboardingProfiles.id, profileId));

			void getProfileById({ id: profileId }).refresh();
			return { success: true, promptId };
		} catch (e) {
			return { success: false, error: (e as Error).message };
		}
	}
);

export const saveProfileQuestion = command(
	z.object({
		id: z.string().optional(),
		profileId: z.string().min(1),
		question: z.string().min(1),
		type: z.string().min(1),
		description: z.string().optional(),
		sidebarTitle: z.string().optional(),
		factKey: z.string().optional(),
		order: z.number().int().min(0),
		enabled: z.boolean(),
		required: z.boolean(),
		group: z.string().optional(),
		optionsText: z.string().optional(),
		showWhenText: z.string().optional(),
		metadataText: z.string().optional()
	}),
	async ({ id, profileId, optionsText, showWhenText, metadataText, ...fields }) => {
		const { locals } = getRequestEvent();
		const db = locals.db;
		const now = new Date().toISOString();

		try {
			const profile = await db
				.select({ id: configOnboardingProfiles.id })
				.from(configOnboardingProfiles)
				.where(eq(configOnboardingProfiles.id, profileId))
				.then((rows) => rows[0] ?? null);

			if (!profile) return { success: false, error: 'Profile not found' };

			let options: unknown;
			let showWhen: unknown;
			let metadata: unknown;
			try {
				options = parseJsonText(optionsText, []);
				showWhen = normalizeShowWhen(parseJsonText(showWhenText, null));
				metadata = parseJsonText(metadataText, null);
			} catch (e) {
				return { success: false, error: `Invalid JSON: ${(e as Error).message}` };
			}

			const payload: Record<string, unknown> = {
				profile: profileId,
				question: fields.question.trim(),
				type: fields.type,
				description: normalizeOptionalText(fields.description),
				sidebarTitle: normalizeOptionalText(fields.sidebarTitle),
				factKey: normalizeOptionalText(fields.factKey),
				order: String(fields.order),
				enabled: fields.enabled,
				required: fields.required,
				group: normalizeOptionalText(fields.group),
				options,
				showWhen,
				metadata,
				updated: now
			};

			if (id) {
				await db
					.update(configOnboardingProfileQuestions)
					.set(payload)
					.where(
						and(
							eq(configOnboardingProfileQuestions.id, id),
							eq(configOnboardingProfileQuestions.profile, profileId)
						)
					);
			} else {
				await db.insert(configOnboardingProfileQuestions).values({
					id: generateId(),
					profile: profileId,
					question: fields.question.trim(),
					type: fields.type,
					description: normalizeOptionalText(fields.description),
					sidebarTitle: normalizeOptionalText(fields.sidebarTitle),
					factKey: normalizeOptionalText(fields.factKey),
					order: String(fields.order),
					enabled: fields.enabled,
					required: fields.required,
					group: normalizeOptionalText(fields.group),
					options,
					showWhen,
					metadata,
					created: now,
					updated: now
				});
			}

			void getProfileById({ id: profileId }).refresh();
			return { success: true };
		} catch (e) {
			return { success: false, error: (e as Error).message };
		}
	}
);

export const deleteProfileQuestion = command(
	z.object({ id: z.string().min(1), profileId: z.string().min(1) }),
	async ({ id, profileId }) => {
		const { locals } = getRequestEvent();
		const db = locals.db;

		try {
			await db
				.delete(configOnboardingProfileQuestions)
				.where(
					and(
						eq(configOnboardingProfileQuestions.id, id),
						eq(configOnboardingProfileQuestions.profile, profileId)
					)
				);

			void getProfileById({ id: profileId }).refresh();
			return { success: true };
		} catch (e) {
			return { success: false, error: (e as Error).message };
		}
	}
);

export const saveProfileCampaign = command(
	z.object({
		id: z.string().optional(),
		profileId: z.string().min(1),
		slug: z.string().min(1),
		displayName: z.string().min(1),
		description: z.string().optional(),
		organizationKey: z.string().optional(),
		organizationName: z.string().optional(),
		sourceType: z.string().min(1),
		isActive: z.boolean()
	}),
	async ({ id, profileId, ...fields }) => {
		const { locals } = getRequestEvent();
		const db = locals.db;
		const now = new Date().toISOString();

		try {
			const payload = {
				slug: slugify(fields.slug),
				displayName: fields.displayName.trim(),
				description: normalizeOptionalText(fields.description),
				organizationKey: normalizeOptionalText(fields.organizationKey),
				organizationName: normalizeOptionalText(fields.organizationName),
				sourceType: fields.sourceType,
				defaultProfile: profileId,
				isActive: fields.isActive,
				updated: now
			};

			if (!payload.slug) return { success: false, error: 'Campaign slug is required' };

			if (id) {
				await db
					.update(configOnboardingCampaigns)
					.set(payload)
					.where(
						and(
							eq(configOnboardingCampaigns.id, id),
							eq(configOnboardingCampaigns.defaultProfile, profileId)
						)
					);
			} else {
				await db.insert(configOnboardingCampaigns).values({
					id: generateId(),
					...payload,
					created: now
				});
			}

			void getProfileById({ id: profileId }).refresh();
			return { success: true };
		} catch (e) {
			return { success: false, error: (e as Error).message };
		}
	}
);

export const saveProfileInviteCode = command(
	z.object({
		id: z.string().optional(),
		profileId: z.string().min(1),
		campaignId: z.string().min(1),
		code: z.string().min(1),
		codeType: z.string().min(1),
		isActive: z.boolean(),
		maxUses: z.number().int().min(1).nullable().optional(),
		expiresAt: z.string().nullable().optional()
	}),
	async ({ id, profileId, campaignId, ...fields }) => {
		const { locals } = getRequestEvent();
		const db = locals.db;
		const now = new Date().toISOString();

		try {
			const campaign = await db
				.select()
				.from(configOnboardingCampaigns)
				.where(
					and(
						eq(configOnboardingCampaigns.id, campaignId),
						eq(configOnboardingCampaigns.defaultProfile, profileId)
					)
				)
				.then((rows) => rows[0] ?? null);

			if (!campaign) return { success: false, error: 'Campaign not found for this profile' };

			const payload = {
				code: fields.code.trim().toUpperCase(),
				campaign: campaignId,
				profileOverride: profileId,
				codeType: fields.codeType,
				isActive: fields.isActive,
				maxUses: fields.maxUses ?? null,
				expiresAt: normalizeOptionalText(fields.expiresAt),
				updated: now
			};

			if (id) {
				await db
					.update(configOnboardingInviteCodes)
					.set(payload)
					.where(eq(configOnboardingInviteCodes.id, id));
			} else {
				await db.insert(configOnboardingInviteCodes).values({
					id: generateId(),
					...payload,
					usedCount: 0,
					created: now
				});
			}

			void getProfileById({ id: profileId }).refresh();
			return { success: true };
		} catch (e) {
			return { success: false, error: (e as Error).message };
		}
	}
);

export const deleteProfile = command(z.object({ id: z.string().min(1) }), async ({ id }) => {
	const { locals } = getRequestEvent();
	const db = locals.db;

	try {
		const existing = await db
			.select()
			.from(configOnboardingProfiles)
			.where(eq(configOnboardingProfiles.id, id))
			.then((rows) => rows[0] ?? null);

		if (!existing) return { success: false, error: 'Profile not found' };
		if (existing.status === 'active') {
			return { success: false, error: 'Cannot delete an active profile. Archive it first.' };
		}

		const campaigns = await db
			.select({ id: configOnboardingCampaigns.id })
			.from(configOnboardingCampaigns)
			.where(eq(configOnboardingCampaigns.defaultProfile, id));
		const campaignIds = campaigns.map((campaign) => campaign.id);

		if (campaignIds.length > 0) {
			await db
				.delete(configOnboardingInviteCodes)
				.where(
					or(
						inArray(configOnboardingInviteCodes.campaign, campaignIds),
						eq(configOnboardingInviteCodes.profileOverride, id)
					)
				);
			await db
				.delete(configOnboardingCampaigns)
				.where(eq(configOnboardingCampaigns.defaultProfile, id));
		} else {
			await db
				.delete(configOnboardingInviteCodes)
				.where(eq(configOnboardingInviteCodes.profileOverride, id));
		}

		// Questions cascade via FK, but explicit delete for clarity
		await db
			.delete(configOnboardingProfileQuestions)
			.where(eq(configOnboardingProfileQuestions.profile, id));
		await db.delete(userOnboardingAssignments).where(eq(userOnboardingAssignments.profile, id));
		await db.delete(configOnboardingProfiles).where(eq(configOnboardingProfiles.id, id));

		void getOnboardingProfiles().refresh();
		return { success: true };
	} catch (e) {
		return { success: false, error: (e as Error).message };
	}
});
