import z from 'zod/v4';

export const compilerOutputSchema = z.object({
	summary: z.object({
		key: z.string().min(1).optional(),
		name: z.string().min(1),
		description: z.string().min(1),
		industryKey: z.string().min(1),
		status: z.enum(['draft', 'active', 'archived']).optional(),
		maxAiQuestions: z.number().int().min(0).max(20),
		sessionTimeoutMs: z.number().int().min(0).nullable().optional(),
		cacheTtlMs: z.number().int().min(0).nullable().optional(),
		enableTrialActivation: z.boolean().optional(),
		visibility: z.enum(['public', 'invite_only', 'hidden']).optional(),
		defaultTags: z.array(z.string()).optional(),
		runtimeModel: z.string().nullable().optional()
	}),
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
		.optional(),
	aiFallbackQuestions: z
		.array(
			z.object({
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
			})
		)
		.optional(),
	questions: z
		.array(
			z.object({
				question: z.string().min(1),
				type: z.enum(['single_select', 'multi_select', 'text', 'number', 'boolean']),
				description: z.string().optional(),
				sidebarTitle: z.string().optional(),
				factKey: z.string().min(1),
				enabled: z.boolean().optional(),
				options: z
					.array(
						z.object({
							label: z.string(),
							value: z.string(),
							grantsTags: z.array(z.string()).optional()
						})
					)
					.optional(),
				order: z.number().int(),
				required: z.boolean(),
				showWhen: z
					.union([
						z.object({
							factKey: z.string(),
							operator: z.enum([
								'eq',
								'neq',
								'in',
								'exists',
								'not_exists',
								'equals',
								'not_equals',
								'includes',
								'includes_any'
							]),
							value: z.union([z.string(), z.array(z.string())]).optional()
						}),
						z.object({
							all: z
								.array(
									z.object({
										factKey: z.string().optional(),
										questionId: z.string().optional(),
										operator: z.enum([
											'exists',
											'not_exists',
											'equals',
											'not_equals',
											'includes',
											'includes_any'
										]),
										value: z.union([z.string(), z.array(z.string())]).optional()
									})
								)
								.optional(),
							any: z
								.array(
									z.object({
										factKey: z.string().optional(),
										questionId: z.string().optional(),
										operator: z.enum([
											'exists',
											'not_exists',
											'equals',
											'not_equals',
											'includes',
											'includes_any'
										]),
										value: z.union([z.string(), z.array(z.string())]).optional()
									})
								)
								.optional()
						})
					])
					.optional(),
				group: z.string().optional()
			})
		)
		.min(1),
	runtimePrompt: z.string().min(10),
	suggestedTags: z.array(z.string())
});

export type CompilerOutput = z.infer<typeof compilerOutputSchema>;

const MAX_DRAFT_QUESTIONS = 20;

export interface CompilerContext {
	markdown: string;
	schemaSections: Array<{
		id: string;
		name: string;
		fields: Array<{ key: string; label: string }>;
	}>;
	tagTaxonomy: string[];
}

export function buildCompilerPrompt(ctx: CompilerContext): {
	system: string;
	context: string;
	user: string;
} {
	const system = `You are an onboarding configuration generator for a multi-domain professional platform.
Given a markdown description of an audience and onboarding goal, generate a complete onboarding profile configuration.
You must output valid JSON matching the provided schema exactly.
Generate thoughtful, well-ordered questions that progressively build understanding of the user.
Questions should be specific enough to be actionable but broad enough to cover the audience.`;

	const schemaBlock =
		ctx.schemaSections.length > 0
			? ctx.schemaSections
					.map(
						(s) =>
							`Section: ${s.name} (${s.id})\n  Fields: ${s.fields.map((f) => `${f.key} (${f.label})`).join(', ')}`
					)
					.join('\n')
			: 'No schema sections defined yet.';

	const tagBlock = ctx.tagTaxonomy.length > 0 ? ctx.tagTaxonomy.join(', ') : 'No tags defined yet.';

	const context = `## Available Profile Schema Sections
${schemaBlock}

## Available Tags
${tagBlock}

## Question Types
- single_select: One choice from options (must include options array)
- multi_select: Multiple choices from options (must include options array)
- text: Free-text input
- number: Numeric input
- boolean: Yes/no toggle

## Output JSON Schema
{
	"summary": { "key"?: string, "name": string, "description": string, "industryKey": string, "status"?: "draft"|"active"|"archived", "maxAiQuestions": number (0-20), "sessionTimeoutMs"?: number|null, "cacheTtlMs"?: number|null, "enableTrialActivation"?: boolean, "visibility"?: "public"|"invite_only"|"hidden", "defaultTags"?: string[], "runtimeModel"?: string|null },
	"disclosures"?: { "enabled": boolean, "items": [{ "id": string, "question": string, "title"?: string, "body"?: string, "type": "acknowledgement"|"accept_deny", "required": boolean, "acceptLabel"?: string, "rejectLabel"?: string, "rejectMessage"?: string }] },
	"questions": [{ "question": string, "type": enum, "factKey": string (snake_case), "description"?: string, "sidebarTitle"?: string, "options"?: [{label, value, grantsTags?: string[]}], "order": number (1-based), "required": boolean, "enabled"?: boolean, "showWhen"?: {"factKey": string, "operator": "equals"|"not_equals"|"includes"|"includes_any"|"exists"|"not_exists", "value"?: string|string[]}, "group"?: string }],
  "aiFallbackQuestions"?: [{ "id": string, "question": string, "type": enum, "factKey": string, "factLabel": string, "sidebarTitle": string, "description"?: string, "options"?: [{label, value}], "required": boolean, "group"?: string }],
  "runtimePrompt": string (system prompt for AI follow-up questions during the live onboarding session - should describe the audience, goals, and tone),
  "suggestedTags": string[] (namespace:value format tags to auto-assign to users completing this profile)
}

## Disclosure Rules
- Use "disclosures" for pre-question acknowledgements or accept/deny gates shown before onboarding questions.
- Use "acknowledgement" when the user only confirms they have read something.
- Use "accept_deny" only when refusing the disclosure should block onboarding.
- Use optional "title", "body", and button labels for long-form consent or terms disclosures.
- Keep disclosures short, explicit, and separate from normal onboarding questions.`;

	return { system, context, user: ctx.markdown };
}

function stripMarkdownInline(value: string): string {
	return value
		.replace(/`([^`]+)`/g, '$1')
		.replace(/\*\*([^*]+)\*\*/g, '$1')
		.replace(/__([^_]+)__/g, '$1')
		.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
		.trim();
}

function slugifyDraftValue(value: string, fallback: string): string {
	const slug = value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80);
	return slug || fallback;
}

function valueKey(value: string, fallback: string): string {
	const key = value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.slice(0, 80);
	return key || fallback;
}

function questionFactKey(question: string, index: number): string {
	const cleaned = question
		.toLowerCase()
		.replace(/\([^)]*\)/g, '')
		.replace(/[?!.,:;]+$/g, '')
		.replace(/^(what|which|where|when|why|how)\s+/g, '')
		.replace(/^(is|are|do|does|did|can|could|would|should|will|have|has)\s+/g, '')
		.replace(/\b(do you|does your|are you|is your|your|you|any|please)\b/g, ' ');

	return valueKey(cleaned, `question_${index + 1}`);
}

function parseOptions(
	raw: string | undefined
): Array<{ label: string; value: string }> | undefined {
	if (!raw) return undefined;
	const options = raw
		.split(/[,;|]/g)
		.map((part) => stripMarkdownInline(part))
		.filter(Boolean)
		.map((label) => ({ label, value: valueKey(label, 'option') }));
	return options.length > 0 ? options : undefined;
}

function extractLevel2Section(markdown: string, name: string): string | null {
	const lines = markdown.split(/\r?\n/);
	const start = lines.findIndex((line) => new RegExp(`^\\s*##\\s+${name}\\s*$`, 'i').test(line));
	if (start === -1) return null;
	const sectionLines: string[] = [];
	for (let index = start + 1; index < lines.length; index += 1) {
		if (/^\s*##\s+/.test(lines[index])) break;
		sectionLines.push(lines[index]);
	}
	return sectionLines.join('\n').trim() || null;
}

function parseKeyValueBlock(block: string): Record<string, string> {
	const values: Record<string, string> = {};
	for (const rawLine of block.split(/\r?\n/)) {
		const line = stripMarkdownInline(rawLine.trim());
		const match = line.match(/^(?:[-*+]\s*)?([a-zA-Z][\w-]*)\s*:\s*(.*)$/);
		if (!match) continue;
		values[match[1].toLowerCase().replace(/-/g, '_')] = match[2].trim();
	}
	return values;
}

function parseBooleanValue(value: string | undefined, fallback: boolean): boolean {
	if (!value) return fallback;
	return /^(true|yes|required|1)$/i.test(value.trim());
}

function parseNumberValue(value: string | undefined, fallback: number): number {
	if (!value) return fallback;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed)) return fallback;
	return Math.min(Math.max(parsed, 0), 20);
}

function parseNullableNumberValue(value: string | undefined): number | null | undefined {
	if (value === undefined) return undefined;
	const trimmed = value.trim();
	if (!trimmed) return null;
	const parsed = Number.parseInt(trimmed, 10);
	if (!Number.isFinite(parsed)) return null;
	return Math.max(parsed, 0);
}

function parseOptionalBooleanValue(value: string | undefined): boolean | undefined {
	if (value === undefined) return undefined;
	return parseBooleanValue(value, false);
}

function parseTagList(raw: string | undefined): string[] {
	if (!raw) return [];
	return [
		...new Set(
			raw
				.split(/[;,\n]/g)
				.map((tag) =>
					stripMarkdownInline(tag)
						.replace(/^[-*+]\s*/, '')
						.trim()
				)
				.filter((tag) => /^[a-z][a-z0-9_-]*:[a-z0-9][a-z0-9_-]*$/i.test(tag))
				.map((tag) => tag.toLowerCase())
		)
	];
}

function normalizeTagArray(value: string[] | null | undefined): string[] {
	if (!Array.isArray(value)) return [];
	return [
		...new Set(
			value
				.filter((tag): tag is string => typeof tag === 'string')
				.map((tag) => tag.trim().toLowerCase())
				.filter((tag) => /^[a-z][a-z0-9_-]*:[a-z0-9][a-z0-9_-]*$/i.test(tag))
		)
	];
}

function normalizeVisibility(value: string | undefined): 'public' | 'invite_only' | 'hidden' {
	if (!value) return 'public';
	const normalized = value
		.trim()
		.toLowerCase()
		.replace(/[\s-]+/g, '_');
	return normalized === 'invite_only' || normalized === 'hidden' ? normalized : 'public';
}

function normalizeStatus(value: string | undefined): 'draft' | 'active' | 'archived' {
	if (!value) return 'draft';
	const normalized = value
		.trim()
		.toLowerCase()
		.replace(/[\s-]+/g, '_');
	return normalized === 'active' || normalized === 'archived' ? normalized : 'draft';
}

function normalizeStrictQuestionType(
	value: string | undefined
): CompilerOutput['questions'][number]['type'] {
	const normalized = value
		?.trim()
		.toLowerCase()
		.replace(/[\s-]+/g, '_');
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

function parseStrictOptions(
	raw: string | undefined
): Array<{ label: string; value: string; grantsTags?: string[] }> | undefined {
	if (!raw) return undefined;
	const options = raw
		.split(/[;\n]/g)
		.map((entry) => entry.trim())
		.filter(Boolean)
		.map((entry) => {
			const [labelRaw, valueRaw, tagsRaw] = entry
				.split('|')
				.map((part) => stripMarkdownInline(part));
			const label = labelRaw || valueRaw;
			const value = valueRaw || valueKey(label, 'option');
			const grantsTags = parseTagList(tagsRaw);
			return {
				label,
				value: valueKey(value, 'option'),
				...(grantsTags.length > 0 ? { grantsTags } : {})
			};
		});

	return options.length > 0 ? options : undefined;
}

function parseStrictShowWhen(
	raw: string | undefined
): CompilerOutput['questions'][number]['showWhen'] {
	const single = parseStrictCondition(raw);
	if (!single) return undefined;
	return { all: [single] };
}

function parseStrictCondition(raw: string | undefined):
	| {
			factKey: string;
			operator: 'exists' | 'not_exists' | 'equals' | 'not_equals' | 'includes' | 'includes_any';
			value?: string | string[];
	  }
	| undefined {
	if (!raw) return undefined;
	const match = raw.trim().match(/^([a-zA-Z][\w.-]*)\s+([a-zA-Z_]+)(?:\s+(.+))?$/);
	if (!match) return undefined;
	const operatorAlias = match[2].toLowerCase();
	const operator =
		operatorAlias === 'eq' || operatorAlias === 'equal' || operatorAlias === 'equals'
			? 'equals'
			: operatorAlias === 'neq' || operatorAlias === 'not_equal' || operatorAlias === 'not_equals'
				? 'not_equals'
				: operatorAlias === 'in' || operatorAlias === 'includes'
					? 'includes'
					: operatorAlias === 'includes_any'
						? 'includes_any'
						: operatorAlias === 'exists' || operatorAlias === 'not_exists'
							? operatorAlias
							: 'equals';
	const valueRaw = match[3]?.trim();
	const value =
		operator === 'includes_any'
			? parseTagList(valueRaw).length > 0
				? parseTagList(valueRaw)
				: valueRaw
						?.split(',')
						.map((part) => stripMarkdownInline(part))
						.filter(Boolean)
			: valueRaw;

	return {
		factKey: match[1],
		operator,
		...(value !== undefined && value !== '' ? { value } : {})
	};
}

function parseStrictConditionList(raw: string | undefined): Array<{
	factKey: string;
	operator: 'exists' | 'not_exists' | 'equals' | 'not_equals' | 'includes' | 'includes_any';
	value?: string | string[];
}> {
	if (!raw) return [];
	return raw
		.split(/[;\n]/g)
		.map((entry) => parseStrictCondition(entry))
		.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
}

function parseStrictCompositeShowWhen(values: Record<string, string>) {
	const all = [
		...parseStrictConditionList(values.show_when),
		...parseStrictConditionList(values.show_when_all)
	];
	const any = parseStrictConditionList(values.show_when_any);

	if (all.length === 0 && any.length === 0) return undefined;
	return {
		...(all.length > 0 ? { all } : {}),
		...(any.length > 0 ? { any } : {})
	};
}

function splitStrictQuestionBlocks(block: string): Array<{ title: string; body: string }> {
	const lines = block.split(/\r?\n/);
	const sections: Array<{ title: string; body: string }> = [];
	let current: { title: string; lines: string[] } | null = null;

	for (const rawLine of lines) {
		const heading = rawLine.match(/^\s*###\s+(.+)$/);
		if (heading) {
			if (current) sections.push({ title: current.title, body: current.lines.join('\n') });
			current = { title: stripMarkdownInline(heading[1]), lines: [] };
			continue;
		}
		current?.lines.push(rawLine);
	}

	if (current) sections.push({ title: current.title, body: current.lines.join('\n') });
	return sections;
}

function parseStrictFallbackQuestionBlocks(
	block: string | null
): NonNullable<CompilerOutput['aiFallbackQuestions']> | undefined {
	if (!block) return undefined;
	const sections = splitStrictQuestionBlocks(block);
	if (sections.length === 0) return undefined;

	const questions = sections.slice(0, MAX_DRAFT_QUESTIONS).map((section, index) => {
		const values = parseKeyValueBlock(section.body);
		const factKey = valueKey(values.fact_key || section.title, `fallback_question_${index + 1}`);
		const sidebarTitle = values.sidebar_title || values.fact_label || section.title;
		return {
			id: valueKey(values.id || `fallback_${factKey}`, `fallback_question_${index + 1}`),
			question: values.question || section.title,
			type: normalizeStrictQuestionType(values.type),
			factKey,
			factLabel: values.fact_label || sidebarTitle,
			sidebarTitle,
			required: parseBooleanValue(values.required, true),
			...(values.description ? { description: values.description } : {}),
			...(values.group ? { group: values.group } : {}),
			...(parseStrictOptions(values.options) ? { options: parseStrictOptions(values.options) } : {})
		};
	});

	return questions.length > 0 ? questions : undefined;
}

function parseStrictDisclosureBlocks(
	block: string | null
): NonNullable<CompilerOutput['disclosures']> | undefined {
	if (!block) return undefined;
	const values = parseKeyValueBlock(block);
	const sections = splitStrictQuestionBlocks(block);
	const items: NonNullable<CompilerOutput['disclosures']>['items'] = sections.map(
		(section, index) => {
			const itemValues = parseKeyValueBlock(section.body);
			return {
				id:
					itemValues.id?.trim() ||
					valueKey(itemValues.question || section.title, `disclosure_${index + 1}`),
				question: itemValues.question || section.title,
				...(itemValues.title ? { title: itemValues.title } : {}),
				...(itemValues.body ? { body: itemValues.body } : {}),
				type: itemValues.type === 'accept_deny' ? 'accept_deny' : 'acknowledgement',
				required: parseBooleanValue(itemValues.required, true),
				...(itemValues.accept_label ? { acceptLabel: itemValues.accept_label } : {}),
				...(itemValues.reject_label ? { rejectLabel: itemValues.reject_label } : {}),
				...(itemValues.reject_message ? { rejectMessage: itemValues.reject_message } : {})
			};
		}
	);

	return {
		enabled: parseBooleanValue(values.enabled, items.length > 0),
		items
	};
}

export function compileStrictOnboardingMarkdown(markdown: string): CompilerOutput | null {
	const profileBlock = extractLevel2Section(markdown, 'Profile');
	const questionsBlock = extractLevel2Section(markdown, 'Questions');
	if (!profileBlock || !questionsBlock) return null;

	const profile = parseKeyValueBlock(profileBlock);
	const questionBlocks = splitStrictQuestionBlocks(questionsBlock);
	if (questionBlocks.length === 0) return null;

	const disclosures = parseStrictDisclosureBlocks(extractLevel2Section(markdown, 'Disclosures'));
	const aiFallbackQuestions = parseStrictFallbackQuestionBlocks(
		extractLevel2Section(markdown, 'AI Fallback Questions') ??
			extractLevel2Section(markdown, 'Fallback Questions')
	);

	const name = extractHeading(markdown) ?? profile.name ?? 'Generated Onboarding Profile';
	const defaultTags = [
		...new Set([
			...parseTagList(profile.default_tags),
			...parseTagList(extractLevel2Section(markdown, 'Default Tags') ?? undefined)
		])
	];

	const questions = questionBlocks.slice(0, MAX_DRAFT_QUESTIONS).map((section, index) => {
		const values = parseKeyValueBlock(section.body);
		return {
			question: values.question || section.title,
			type: normalizeStrictQuestionType(values.type),
			factKey: valueKey(values.fact_key || section.title, `question_${index + 1}`),
			order: index + 1,
			required: parseBooleanValue(values.required, true),
			enabled: parseBooleanValue(values.enabled, true),
			...(values.description ? { description: values.description } : {}),
			...(values.sidebar_title ? { sidebarTitle: values.sidebar_title } : {}),
			...(values.group ? { group: values.group } : {}),
			...(parseStrictOptions(values.options)
				? { options: parseStrictOptions(values.options) }
				: {}),
			...(parseStrictCompositeShowWhen(values)
				? { showWhen: parseStrictCompositeShowWhen(values) }
				: {})
		};
	});

	return {
		summary: {
			...(profile.key
				? { key: slugifyDraftValue(profile.key, 'generated-onboarding-profile') }
				: {}),
			name,
			description: profile.description || extractDescription(markdown, name),
			industryKey: valueKey(
				profile.industry_key || profile.key || name,
				'generated_onboarding_profile'
			),
			...(profile.status ? { status: normalizeStatus(profile.status) } : {}),
			maxAiQuestions: parseNumberValue(
				profile.max_ai_questions,
				Math.min(Math.max(questions.length, 3), 8)
			),
			...(profile.session_timeout_ms !== undefined
				? { sessionTimeoutMs: parseNullableNumberValue(profile.session_timeout_ms) ?? null }
				: {}),
			...(profile.cache_ttl_ms !== undefined
				? { cacheTtlMs: parseNullableNumberValue(profile.cache_ttl_ms) ?? null }
				: {}),
			...(profile.enable_trial_activation !== undefined
				? {
						enableTrialActivation:
							parseOptionalBooleanValue(profile.enable_trial_activation) ?? true
					}
				: {}),
			...(profile.visibility ? { visibility: normalizeVisibility(profile.visibility) } : {}),
			defaultTags,
			...(profile.runtime_model ? { runtimeModel: profile.runtime_model } : {})
		},
		...(disclosures ? { disclosures } : {}),
		...(aiFallbackQuestions ? { aiFallbackQuestions } : {}),
		questions,
		runtimePrompt:
			extractLevel2Section(markdown, 'Prompt') ||
			`You are running onboarding for ${name}. Ask concise follow-up questions only when they help complete missing profile details.`,
		suggestedTags: defaultTags
	};
}

export interface ExportableStrictOnboardingProfile {
	name: string;
	key?: string | null;
	description?: string | null;
	industryKey?: string | null;
	status?: 'draft' | 'active' | 'archived' | string | null;
	visibility?: 'public' | 'invite_only' | 'hidden' | string | null;
	defaultTags?: string[] | null;
	runtimeModel?: string | null;
	maxAiQuestions?: number | string | null;
	sessionTimeoutMs?: number | string | null;
	cacheTtlMs?: number | string | null;
	enableTrialActivation?: boolean | null;
	disclosures?: CompilerOutput['disclosures'] | null;
	promptTemplate?: string | null;
	questions: CompilerOutput['questions'];
	aiFallbackQuestions?: CompilerOutput['aiFallbackQuestions'] | null;
}

function normalizeExportOperator(operator: string): string {
	if (operator === 'eq') return 'equals';
	if (operator === 'neq') return 'not_equals';
	if (operator === 'in') return 'includes_any';
	return operator;
}

function formatConditionValue(value: string | string[] | undefined): string {
	if (Array.isArray(value)) return value.join(', ');
	return value ?? '';
}

function formatCondition(condition: {
	factKey?: string;
	questionId?: string;
	operator: string;
	value?: string | string[];
}): string | null {
	const target = condition.factKey || condition.questionId;
	if (!target) return null;
	const operator = normalizeExportOperator(condition.operator);
	if (operator === 'exists' || operator === 'not_exists') {
		return `${target} ${operator}`;
	}
	const value = formatConditionValue(condition.value);
	return value ? `${target} ${operator} ${value}` : `${target} ${operator}`;
}

function formatShowWhenLines(showWhen: CompilerOutput['questions'][number]['showWhen']): string[] {
	if (!showWhen) return [];
	if ('operator' in showWhen) {
		const single = formatCondition(showWhen);
		return single ? [`- show_when: ${single}`] : [];
	}
	const all = (showWhen.all ?? []).map(formatCondition).filter(Boolean) as string[];
	const any = (showWhen.any ?? []).map(formatCondition).filter(Boolean) as string[];
	if (all.length === 1 && any.length === 0) {
		return [`- show_when: ${all[0]}`];
	}
	return [
		...(all.length > 0 ? [`- show_when_all: ${all.join('; ')}`] : []),
		...(any.length > 0 ? [`- show_when_any: ${any.join('; ')}`] : [])
	];
}

function formatOptionsLine(
	options: Array<{ label: string; value: string; grantsTags?: string[] }> | undefined
): string | null {
	if (!options || options.length === 0) return null;
	return options
		.map((option) => {
			const tags = option.grantsTags?.filter(Boolean).join(' ') ?? '';
			return tags
				? `${option.label} | ${option.value} | ${tags}`
				: `${option.label} | ${option.value}`;
		})
		.join('; ');
}

function formatBooleanLine(key: string, value: boolean): string {
	return `- ${key}: ${value ? 'true' : 'false'}`;
}

function formatScalarValue(value: number | string | null | undefined): string {
	if (value === null || value === undefined) return '';
	return String(value);
}

export function buildStrictOnboardingMarkdownExport(
	data: ExportableStrictOnboardingProfile
): string {
	const name = data.name.trim() || 'Generated Onboarding Profile';
	const key =
		data.key?.trim() || slugifyDraftValue(data.industryKey || name, 'generated-onboarding-profile');
	const description = data.description?.trim() || `Generated onboarding profile for ${name}.`;
	const industryKey = data.industryKey?.trim() || key;
	const status = normalizeStatus(typeof data.status === 'string' ? data.status : undefined);
	const visibility = normalizeVisibility(
		typeof data.visibility === 'string' ? data.visibility : undefined
	);
	const defaultTags = normalizeTagArray(data.defaultTags ?? []);
	const promptTemplate =
		data.promptTemplate?.trim() ||
		`You are running onboarding for ${name}. Ask concise follow-up questions only when they help complete missing profile details.`;
	const questions = [...data.questions].sort((left, right) => left.order - right.order);
	const lines: string[] = [
		`# ${name}`,
		'',
		'## Profile',
		`- key: ${key}`,
		`- description: ${description}`,
		`- industry_key: ${industryKey}`,
		`- status: ${status}`,
		`- visibility: ${visibility}`,
		`- default_tags: ${defaultTags.join(', ')}`,
		`- runtime_model: ${data.runtimeModel?.trim() ?? ''}`,
		`- max_ai_questions: ${formatScalarValue(data.maxAiQuestions ?? 0)}`,
		`- session_timeout_ms: ${formatScalarValue(data.sessionTimeoutMs)}`,
		`- cache_ttl_ms: ${formatScalarValue(data.cacheTtlMs)}`,
		formatBooleanLine('enable_trial_activation', data.enableTrialActivation ?? true)
	];

	if (data.disclosures) {
		lines.push('', '## Disclosures', formatBooleanLine('enabled', data.disclosures.enabled));
		for (const item of data.disclosures.items) {
			lines.push(
				'',
				`### ${item.title || item.question}`,
				`- id: ${item.id}`,
				`- question: ${item.question}`,
				...(item.title ? [`- title: ${item.title}`] : []),
				...(item.body ? [`- body: ${item.body}`] : []),
				`- type: ${item.type}`,
				formatBooleanLine('required', item.required),
				...(item.acceptLabel ? [`- accept_label: ${item.acceptLabel}`] : []),
				...(item.rejectLabel ? [`- reject_label: ${item.rejectLabel}`] : []),
				...(item.rejectMessage ? [`- reject_message: ${item.rejectMessage}`] : [])
			);
		}
	}

	lines.push('', '## Prompt', promptTemplate, '', '## Questions');

	for (const question of questions) {
		lines.push(
			`### ${question.sidebarTitle || question.question}`,
			`- question: ${question.question}`,
			`- type: ${question.type}`,
			`- fact_key: ${question.factKey}`,
			formatBooleanLine('required', question.required),
			formatBooleanLine('enabled', question.enabled ?? true)
		);
		if (question.description) lines.push(`- description: ${question.description}`);
		if (question.sidebarTitle) lines.push(`- sidebar_title: ${question.sidebarTitle}`);
		if (question.group) lines.push(`- group: ${question.group}`);
		const optionsLine = formatOptionsLine(question.options);
		if (optionsLine) lines.push(`- options: ${optionsLine}`);
		lines.push(...formatShowWhenLines(question.showWhen), '');
	}

	if (data.aiFallbackQuestions && data.aiFallbackQuestions.length > 0) {
		lines.push('## AI Fallback Questions');
		for (const question of data.aiFallbackQuestions) {
			lines.push(
				`### ${question.sidebarTitle || question.factLabel || question.question}`,
				`- id: ${question.id}`,
				`- question: ${question.question}`,
				`- type: ${question.type}`,
				`- fact_key: ${question.factKey}`,
				`- fact_label: ${question.factLabel}`,
				`- sidebar_title: ${question.sidebarTitle}`,
				formatBooleanLine('required', question.required)
			);
			if (question.description) lines.push(`- description: ${question.description}`);
			if (question.group) lines.push(`- group: ${question.group}`);
			const optionsLine = formatOptionsLine(question.options);
			if (optionsLine) lines.push(`- options: ${optionsLine}`);
			lines.push('');
		}
	}

	return (
		lines
			.join('\n')
			.replace(/\n{3,}/g, '\n\n')
			.trim() + '\n'
	);
}

function questionType(
	question: string,
	options: Array<{ label: string; value: string }> | undefined
): CompilerOutput['questions'][number]['type'] {
	if (options && options.length > 0) {
		return /\b(which|select all|asset classes|hold|apply)\b/i.test(question)
			? 'multi_select'
			: 'single_select';
	}
	if (/^(do|does|are|is|have|has|can|will|would|should)\b/i.test(question)) return 'boolean';
	if (/\b(how many|how much|number|count|amount|income)\b/i.test(question)) {
		return 'number';
	}
	return 'text';
}

function extractHeading(markdown: string): string | null {
	const heading = markdown.match(/^\s*#{1,2}\s+(.+)$/m)?.[1];
	return heading ? stripMarkdownInline(heading) : null;
}

function extractDescription(markdown: string, name: string): string {
	for (const rawLine of markdown.split(/\r?\n/)) {
		const line = stripMarkdownInline(rawLine);
		if (!line) continue;
		if (line.startsWith('#')) continue;
		if (/^[-*+]\s+/.test(line) || /^\d+[.)]\s+/.test(line)) continue;
		if (/\?$/.test(line)) continue;
		if (/\b[a-z][a-z0-9_-]*:[a-z0-9][a-z0-9_-]*\b/i.test(line)) continue;
		return line.slice(0, 500);
	}
	return `Generated onboarding profile for ${name}.`;
}

function extractSuggestedTags(markdown: string): string[] {
	const tags = markdown.match(/\b[a-z][a-z0-9_-]*:[a-z0-9][a-z0-9_-]*\b/gi) ?? [];
	return [...new Set(tags.map((tag) => tag.toLowerCase()))];
}

function extractQuestions(markdown: string): CompilerOutput['questions'] {
	const questions: CompilerOutput['questions'] = [];
	let currentGroup: string | undefined;

	for (const rawLine of markdown.split(/\r?\n/)) {
		const headingMatch = rawLine.match(/^\s*#{2,4}\s+(.+)$/);
		if (headingMatch) {
			const heading = stripMarkdownInline(headingMatch[1]);
			currentGroup = /questions?|intake|discovery|profile/i.test(heading) ? undefined : heading;
			continue;
		}

		const stripped = stripMarkdownInline(
			rawLine
				.trim()
				.replace(/^[-*+]\s+/, '')
				.replace(/^\d+[.)]\s+/, '')
				.replace(/^question\s*[:.-]\s*/i, '')
		);
		if (!stripped.includes('?')) continue;

		const optionMatch = stripped.match(/^(.*?\?)\s*\(([^)]+)\)\s*$/);
		const question = stripMarkdownInline(
			optionMatch?.[1] ?? stripped.match(/^.*?\?/)?.[0] ?? stripped
		);
		if (!question) continue;

		const options = parseOptions(optionMatch?.[2]);
		questions.push({
			question,
			type: questionType(question, options),
			factKey: questionFactKey(question, questions.length),
			options,
			order: questions.length + 1,
			required: true,
			...(currentGroup ? { group: currentGroup } : {})
		});

		if (questions.length >= MAX_DRAFT_QUESTIONS) break;
	}

	if (questions.length > 0) return questions;

	return [
		{
			question: 'What should we know to personalize your onboarding?',
			type: 'text',
			factKey: 'personalization_context',
			order: 1,
			required: true
		}
	];
}

export function compileOnboardingMarkdownDraft(markdown: string): CompilerOutput {
	const trimmed = markdown.trim();
	const strict = compileStrictOnboardingMarkdown(trimmed);
	if (strict) return strict;

	const name = extractHeading(trimmed) ?? 'Generated Onboarding Profile';
	const questions = extractQuestions(trimmed);

	return {
		summary: {
			name,
			description: extractDescription(trimmed, name),
			industryKey: slugifyDraftValue(name, 'generated-onboarding-profile'),
			maxAiQuestions: Math.min(Math.max(questions.length, 3), 8)
		},
		questions,
		runtimePrompt: `You are running onboarding for ${name}. Ask concise follow-up questions only when they help complete missing profile details. Keep the tone professional, practical, and specific to the user's situation.`,
		suggestedTags: extractSuggestedTags(trimmed)
	};
}

export function validateCompilerOutput(
	data: unknown
): { success: true; data: CompilerOutput } | { success: false; error: unknown } {
	const result = compilerOutputSchema.safeParse(data);
	if (result.success) {
		return { success: true, data: result.data };
	}
	return { success: false, error: result.error };
}
