/**
 * Prompts — Constants & Utilities
 *
 * Single source of truth for all AI prompt text and prompt utilities.
 * Handles:
 * - All AI prompt constants (organized by domain)
 * - Loading configurable prompts from the database
 * - Interpolating template variables {{variable}}
 * - Injecting runtime user attributes {{attribute_key}}
 * - Default prompt fallbacks
 *
 * Prompt constants serve as DEFAULT FALLBACKS — the `ai_prompts`
 * table is the source of truth at runtime. If a prompt_key exists in
 * the DB, the DB version wins. If not, the constant here is used.
 *
 * Template variables use {{variable}} syntax and are interpolated at runtime.
 */

import type { Database } from '@repo/db/types';
import { aiPrompts } from '@repo/db/schema';
import { eq } from 'drizzle-orm';
import type { ResolvedAttributes } from './attribute-resolver';
import { createTTLCache } from './ttl-cache';

// ============================================================================
// Prompt Constants — Document Processing
// ============================================================================

export const CHUNK_CONTEXTUALIZATION = `You are analyzing a financial document. Given this text excerpt, provide a brief 1-sentence description of what this section contains. Be specific about any numbers, dates, or entities mentioned.

{{heading}}
Text:
{{text}}

Description:`;

export const BATCH_CHUNK_CONTEXTUALIZATION = `You are analyzing a financial document. For each numbered text chunk below, provide a brief 1-sentence description of what that section contains. Be specific about any numbers, dates, or entities mentioned.

{{chunks}}

Respond with ONLY numbered descriptions matching each chunk, one per line:
1. <description for chunk 1>
2. <description for chunk 2>
...`;

export const DOCUMENT_EXTRACTION = `Analyze this financial document and extract structured information.

Document (first 4000 chars):
{{sample_text}}

Respond in this exact JSON format:
{
  "docType": "the type of document (e.g., Tax Return, Portfolio Statement, Bank Statement, Contract)",
  "summary": "2-3 sentence summary of the document",
  "entities": [
    {"name": "entity name", "type": "person|company|account|date|amount", "properties": {}}
  ],
  "facts": [
    {"text": "a specific fact from the document", "category": "financial|personal|legal|temporal", "confidence": 0.9}
  ]
}

Only include facts that are clearly stated. Be specific with numbers and dates.`;

export const DOCUMENT_EXTRACTION_SYSTEM = `You are a document analyzer. Extract structured information from documents.`;

// ============================================================================
// Prompt Constants — Chat & Agent
// ============================================================================

export const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant. Be concise, accurate, and helpful.

{{personality}}

{{user_context}}`;

export const AGENT_INSTRUCTIONS = `## Instructions:
1. Use the context above to provide personalized, informed responses.
2. If you reference specific numbers or facts, cite where they came from.
3. Be proactive - if you see connections between different pieces of information, mention them.
4. If you need more specific information, ask the user.

## Saving Notes:
When the user asks you to save, note, or bookmark something from the conversation:
1. Summarize what you plan to save as a note (title + key content).
2. Ask the user for confirmation using the ask_confirmation tool.
3. Only after the user confirms, use the create_note tool with an appropriate category and tags.
4. Never save notes without user confirmation.`;

export const CHAT_TITLE_GENERATION = `Generate a concise, descriptive title (max 50 chars) for this chat conversation.
The title should capture the main topic or intent.

User's first message:
{{userMessage}}

Assistant's response (excerpt):
{{assistantResponse}}

Return ONLY the title, nothing else. No quotes, no prefix like "Title:".`;

export const INTENT_CLASSIFICATION = `Classify the user's intent into one of these categories:
{{categories}}

User message: {{message}}

Respond with ONLY the category id.`;

export const CLASSIFIER_NODE_DEFAULT = `Classify the following input into one of these categories:
{{categoryDescriptions}}

Input: {{input}}

Respond with ONLY the exact category id (one of: {{categoryIds}}). No explanation, just the category id.`;

export const CLASSIFIER_NODE_SUFFIX = `

Categories:
{{categoryDescriptions}}

IMPORTANT: Respond with ONLY the exact category id (one of: {{categoryIds}}). No explanation, no formatting, just the category id.`;

// ============================================================================
// Prompt Constants — Notes & Categorization
// ============================================================================

export const NOTE_CATEGORIZATION = `You are a note categorization assistant. Given the following note content, return a JSON object with:
- "category": a short category label (2-4 words, e.g. "Tax Strategy", "Portfolio Analysis", "Retirement Planning", "Market Research")
- "tags": an array of up to 5 short keyword tags relevant to the content

{{agentContext}}

Note content:
{{noteContent}}

Respond ONLY with valid JSON, no other text. Example: {"category": "Tax Strategy", "tags": ["tax", "deductions", "filing", "IRS"]}`;

// ============================================================================
// Prompt Constants — RAG / Search
// ============================================================================

export const SEARCH_KNOWLEDGE_BASE_DESCRIPTION = `Search the user's documents and knowledge base for relevant information. Use this when the user asks about their files or documents.`;

export const QUERY_REWRITE = `You are helping improve search quality. Given this user question, generate {{maxVariations}} alternative phrasings that capture the same intent but use different words.

User Question: "{{userQuery}}"

Generate exactly {{maxVariations}} alternatives, one per line. No numbering, no explanations, just the rephrased queries:`;

// ============================================================================
// Prompt Constants — Session & Extraction
// ============================================================================

export const SESSION_EXTRACTION = `Analyze this conversation and extract a summary, entities, and topics.
Current date/time: {{currentDateTime}}

Conversation ({{messageCount}} exchanges):
{{conversationText}}
{{existingEntitiesBlock}}
{{sessionEndNote}}

Extract in JSON format:
{
  "summary": "{{summaryInstruction}}",
  "newEntities": [{"name": "entity name", "type": "person|company|account|date|amount", "expires_at": "ISO date or null", "supersedes": ["old_entity_id"]}],
  "mentionedTopics": ["topic1", "topic2"]
}

For entities that are time-bound (appointments, trips, deadlines, temporary states), include an "expires_at" ISO date estimating when the info becomes irrelevant. For permanent entities, omit "expires_at" or set it to null.
If a new entity updates or contradicts an existing one from the list above, include their ID in "supersedes". Otherwise omit "supersedes".

Only include information explicitly stated or clearly implied. Be conservative and specific.`;

// ============================================================================
// Prompt Constants — Profiling
// ============================================================================

export const PROFILE_EXTRACTION = `{{profilerSystemPrompt}}

{{schemaDefinitions}}

{{profileContext}}

---
CONVERSATION ({{messageCount}} exchanges):
{{conversationText}}
---

Analyze the conversation above and extract only stable profile information the user explicitly stated.
Use EXACT keys from the schema when the info matches a schema field.
Do not infer family status, debt, assets, income, investment experience, or preferences unless the user directly states them.
For info that doesn't fit any schema field, create a new snake_case key only when it is explicit, durable, and useful.
Return ONLY updated/new fields, not the entire profile.
If no profile-relevant info was found, return: { "updates": [] }

IMPORTANT: Use the bare section_id (e.g. "financial", "goals") without brackets.

Output JSON:
{ "updates": [{ "section": "section_id", "fields": { "field_key": { "value": "extracted value", "label": "Display Label" } } }] }`;

export const PROFILE_SCHEMA_GENERATION = `You are a schema generator for a user-profiling system.

Given the following profiler system prompt, generate a JSON array of profile schema sections.

Each section object must have:
- "section_id": snake_case unique identifier (e.g. "personal", "financial")
- "label": Human-readable section label
- "icon": A Lucide icon name that fits the section (e.g. "user", "briefcase", "bar-chart-3", "target", "settings", "heart", "wallet", "shield")
- "order": Integer sort order starting at 1
- "fields": Array of field objects, each with:
  - "key": snake_case field identifier
  - "label": Display label
  - "type": one of "text", "number", "date", "list"
  - "description": Brief hint for the LLM about what this field represents

Return ONLY the JSON array, no markdown fences or explanation.

System prompt to analyze:
{{systemPrompt}}`;

export const PROFILE_SUMMARY_SYSTEM = `You are a professional financial advisor assistant. Generate a comprehensive client profile summary based on the provided information. Write in clear, professional prose.`;

export const PROFILE_SUMMARY_USER = `Generate a comprehensive profile summary for this client:

{{contextSections}}

Write a professional summary document in markdown format.`;

// ============================================================================
// Prompt Constants — Onboarding
// ============================================================================

export const ONBOARDING_SYSTEM_PROMPT = `You are an expert financial advisor creating a personalized onboarding experience. Your goal is to understand the user's financial situation, goals, and preferences by generating ONE relevant, engaging question at a time.

CRITICAL REQUIREMENTS:
1. For 'checkbox' (single choice) and 'multiselect' (multiple choice) question types, you MUST provide 3-6 options.
2. Each option MUST have: value (snake_case), label (user-friendly text), icon (Phosphor format like 'ph:icon-name-duotone'), and optionally description.
3. NEVER generate a checkbox or multiselect question without options - the UI will break.

GUIDELINES:
1. Generate questions that build upon the user's previous answers to make the journey feel connected and intelligent.
2. Prefer 'checkbox' (single choice) or 'multiselect' (multiple choice) question types.
3. Keep questions concise, friendly, and easy to answer.
4. Avoid asking for sensitive data like exact income.
5. The factKey should be a concise snake_case identifier (e.g., 'risk_tolerance', 'investment_goals').
6. The factLabel should be a clear, professional label for UI display (e.g., 'Risk Tolerance', 'Investment Goals').

Focus on understanding:
- Financial goals and priorities
- Risk tolerance and investment preferences
- Time horizons and life stage
- Asset class preferences
- Current financial situation (general, not specific amounts)

**Current Profile Data:**
{{profiler_data}}

**Previous Answers:**
{{previous_answers}}`;

export const ONBOARDING_AI_RESPONSE_SUFFIX = `IMPORTANT: You MUST respond with ONLY a valid JSON object matching the configured output schema.

The object must contain a "question" object and a "reasoning" string. The question object must include id, factKey, factLabel, type, question, sidebarTitle, options, and required. Use "checkbox" for a single choice list, "multiselect" for multiple choices, "text" for free text, and "number" for numeric answers. For checkbox and multiselect questions, include 3-6 options.

Stay strictly within the domain, audience, and purpose described in the profile prompt above. Do not ask generic financial, investment, portfolio, retirement, or risk-tolerance questions unless the profile prompt explicitly describes a financial planning or investment profile.

Do NOT include text before or after the JSON object. Do NOT include markdown fences, commentary, or explanations outside JSON.`;

export function buildOnboardingQuestionSystemPrompt(adminPrompt: string): string {
	const trimmed = adminPrompt.trim();
	return `${trimmed}\n\n${ONBOARDING_AI_RESPONSE_SUFFIX}`;
}

export const ONBOARDING_QUESTION_USER = `{{context}}

Generate the next relevant question to deepen the user's profile based on what they have shared so far.`;

// ============================================================================
// AI Question Generation — Prompt Builder
// ============================================================================

export interface AIQuestionPromptInput {
	profileSystemPrompt: string;
	answeredFacts: Array<{ factKey: string; label: string; answer: string | string[] }>;
}

/**
 * Builds a prompt for generating personalized onboarding questions
 * based on the profile system prompt and already-answered facts.
 * Schema-gap awareness is intentionally omitted — all onboarding data
 * is stored in transcript, and the profiler runs post-completion to
 * prefill any overlapping config_profile_schema fields.
 */
export function buildAIQuestionPrompt(input: AIQuestionPromptInput): string {
	const answeredBlock =
		input.answeredFacts.length > 0
			? input.answeredFacts
					.map((f) => `- ${f.label}: ${Array.isArray(f.answer) ? f.answer.join(', ') : f.answer}`)
					.join('\n')
			: 'No facts collected yet.';

	return `${input.profileSystemPrompt}

You are generating a personalized onboarding question for this user.

## Already Answered
${answeredBlock}

## Instructions
Generate ONE question that deepens the user's profile based on what they have shared so far.
The question must use one of these types: single_select, multi_select, text, number, boolean.
The factKey should be a descriptive snake_case key for the information being collected.
Do NOT ask about information already provided in the "Already Answered" section above.
Prioritize questions that unlock the most downstream profile value.
For single_select and multi_select questions, provide 3-6 clear options.
Keep questions conversational and specific to the user's context.`;
}

export const ONBOARDING_TAG_ASSIGNMENT = `You are analyzing a new user's onboarding profile to determine which tags should be assigned to them.

USER PROFILE (from onboarding answers):
{{user_facts}}

AVAILABLE TAGS (namespace:tag — description):
{{tag_catalog}}

TASK:
Based on the user's profile data, select ALL tags that apply to this user. Only select tags where you have reasonable confidence from the answers provided.

Rules:
- Do NOT assign geo: tags (those are handled automatically from location detection).
- Do NOT assign tier: tags (those are granted by subscription plans).
- Focus on segment: and role: tags that match the user's profile, goals, and situation.
- Only assign a tag if the user's answers clearly support it. Do not guess.
- If no tags match, return an empty array.

RESPONSE FORMAT (JSON):
{
  "tags": ["segment:example", "role:example"],
  "reasoning": "Brief explanation of why each tag was assigned"
}`;

export const AGENT_SHELF_SELECTION = `You are analyzing a user's financial profile to recommend the most relevant AI agents.

USER PROFILE:
{{user_facts}}

AVAILABLE AGENTS:
{{agent_list}}

TASK:
Select 3-5 agents that would be MOST useful for this specific user based on their:
- Age and life stage
- Financial goals and priorities
- Current financial situation
- Risk tolerance
- Any specific needs mentioned

RESPONSE FORMAT (JSON):
{
  "agents": ["agent_id_1", "agent_id_2", "agent_id_3"],
  "reasoning": "Brief explanation of why these agents were selected"
}

IMPORTANT:
- Order agents by relevance (most relevant first)
- Only select agents that genuinely match the user's needs
- A 20-year-old likely doesn't need a Retirement Planner as top priority
- Someone focused on debt should see Debt Doctor prominently`;

// ============================================================================
// Prompt Constants — Suggestions
// ============================================================================

export const PERSONALIZED_SUGGESTIONS_SYSTEM = `You are generating personalized chat suggestions for a specialized financial AI agent.

## Agent Details:
- Name: {{agentName}}
- Specialty: {{agentDescription}}

## Your Task:
Generate {{suggestionsCount}} highly relevant suggestions that a user might want to ask THIS SPECIFIC agent based on their context.

IMPORTANT: All suggestions must be written from the USER's perspective — as if the user is asking or requesting something. They should read like natural questions or requests a person would type into a chat. Do NOT write them as instructions or commands directed at the agent.

## Rules:
1. Prompts must be phrased as user questions or requests (e.g. "How is my portfolio performing?" or "Can you help me plan my taxes?"), NOT as agent instructions (e.g. "Analyze the portfolio" or "Create a tax plan")
2. Titles should be 2-4 words, topic-oriented
3. Descriptions should be 5-8 words summarizing what the user wants to know or do
4. Prompts should be natural 15-30 word questions/requests written in first person
5. Match icons: analysis, planning, research, or action
6. Make suggestions SPECIFIC to the user's context`;

export const PERSONALIZED_SUGGESTIONS_USER = `## User Context:
{{contextSummary}}

Generate {{suggestionsCount}} suggestions for the "{{agentName}}" agent. Remember: write each suggestion as a question or request from the user's perspective, not as an instruction to the agent.`;

// ============================================================================
// Prompt Key Map (for DB seeding / lookup)
// ============================================================================

/**
 * Maps prompt keys (used in ai_prompts table) to their default constants.
 * This is the single source of truth for all prompt defaults.
 */
export const PROMPT_DEFAULTS = {
	chunk_contextualization: CHUNK_CONTEXTUALIZATION,
	batch_chunk_contextualization: BATCH_CHUNK_CONTEXTUALIZATION,
	document_extraction: DOCUMENT_EXTRACTION,
	document_extraction_system: DOCUMENT_EXTRACTION_SYSTEM,
	default_system_prompt: DEFAULT_SYSTEM_PROMPT,
	agent_instructions: AGENT_INSTRUCTIONS,
	chat_title_generation: CHAT_TITLE_GENERATION,
	intent_classification: INTENT_CLASSIFICATION,
	note_categorization: NOTE_CATEGORIZATION,
	search_knowledge_base_description: SEARCH_KNOWLEDGE_BASE_DESCRIPTION,
	query_rewrite: QUERY_REWRITE,
	session_extraction: SESSION_EXTRACTION,
	profile_extraction: PROFILE_EXTRACTION,
	profile_schema_generation: PROFILE_SCHEMA_GENERATION,
	profile_summary_system: PROFILE_SUMMARY_SYSTEM,
	profile_summary_user: PROFILE_SUMMARY_USER,
	onboarding_system_prompt: ONBOARDING_SYSTEM_PROMPT,
	onboarding_question_user: ONBOARDING_QUESTION_USER,
	onboarding_tag_assignment: ONBOARDING_TAG_ASSIGNMENT,
	agent_shelf_selection: AGENT_SHELF_SELECTION,
	personalized_suggestions_system: PERSONALIZED_SUGGESTIONS_SYSTEM,
	personalized_suggestions_user: PERSONALIZED_SUGGESTIONS_USER,
	classifier_node_default: CLASSIFIER_NODE_DEFAULT,
	classifier_node_suffix: CLASSIFIER_NODE_SUFFIX
} as const;

export type PromptKey = keyof typeof PROMPT_DEFAULTS;

const promptCache = createTTLCache<Map<string, string>>(5 * 60 * 1000);

// ============================================================================
// Prompt Loading
// ============================================================================

/**
 * Load all active prompts from the database
 */
export async function loadPrompts(db: Database): Promise<Map<string, string>> {
	const cached = promptCache.get();
	if (cached) return cached;

	const records = await db
		.select({
			promptKey: aiPrompts.promptKey,
			promptTemplate: aiPrompts.promptTemplate
		})
		.from(aiPrompts)
		.where(eq(aiPrompts.isActive, true));

	const map = new Map<string, string>();
	for (const record of records) {
		if (record.promptKey && record.promptTemplate) {
			map.set(record.promptKey, record.promptTemplate);
		}
	}

	promptCache.set(map);
	return map;
}

/**
 * Get a specific prompt by key
 */
export async function getPrompt(
	db: Database,
	promptKey: string,
	fallback?: string
): Promise<string> {
	const prompts = await loadPrompts(db);
	return prompts.get(promptKey) ?? fallback ?? '';
}

/**
 * Interpolate variables into a prompt template
 * Supports {{variable}} and {{nested.path}} syntax
 */
export function interpolatePrompt(template: string, variables: Record<string, unknown>): string {
	return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
		const value = path.split('.').reduce((obj: unknown, key: string) => {
			return obj && typeof obj === 'object' ? (obj as Record<string, unknown>)[key] : undefined;
		}, variables);
		return value !== undefined ? String(value) : match;
	});
}

/**
 * Clear the prompt cache (call when prompts are updated)
 */
export function clearPromptCache(): void {
	promptCache.clear();
}

/** Alias for consumers that use `DEFAULT_PROMPTS.key` */
export const DEFAULT_PROMPTS = PROMPT_DEFAULTS;

/**
 * Get a prompt with fallback to default
 */
export async function getPromptWithFallback(
	db: Database,
	promptKey: PromptKey,
	variables?: Record<string, unknown>
): Promise<string> {
	const template = await getPrompt(db, promptKey, PROMPT_DEFAULTS[promptKey]);
	return variables ? interpolatePrompt(template, variables) : template;
}

// ============================================================================
// Attribute Injection Types
// ============================================================================

export interface InjectionResult {
	/** The prompt with attributes injected */
	result: string;
	/** Number of placeholders that were successfully injected */
	injectedCount: number;
	/** Keys of the attributes that were injected */
	injectedKeys: string[];
	/** Placeholders that could not be resolved (attribute not found) */
	unresolvedPlaceholders: string[];
}

export interface InjectionOptions {
	/**
	 * If true, unresolved {{placeholders}} are kept in the output.
	 * If false (default), they're replaced with fallbackValue.
	 */
	keepUnresolvedPlaceholders?: boolean;

	/**
	 * Value to use when an attribute is not found.
	 * Default: empty string
	 */
	fallbackValue?: string;
}

// ============================================================================
// Attribute Injection
// ============================================================================

/**
 * Replaces {{attribute_key}} placeholders in a prompt with actual values
 *
 * @example
 * const prompt = "You are assisting a user from {{residence_country}} who is {{age}} years old.";
 * const result = injectAttributesIntoPrompt(prompt, { residence_country: "US", age: 35 });
 */
export function injectAttributesIntoPrompt(
	prompt: string,
	attributes: ResolvedAttributes,
	options: InjectionOptions = {}
): InjectionResult {
	const { keepUnresolvedPlaceholders = false, fallbackValue = '' } = options;

	const injectedKeys: string[] = [];
	const unresolvedPlaceholders: string[] = [];

	const result = prompt.replace(/\{\{(\w+)\}\}/g, (match, key) => {
		const value = attributes[key];

		if (value !== undefined && value !== null) {
			injectedKeys.push(key);
			return formatAttributeValue(value);
		}

		unresolvedPlaceholders.push(key);

		if (keepUnresolvedPlaceholders) {
			return match;
		}

		return fallbackValue;
	});

	return {
		result,
		injectedCount: injectedKeys.length,
		injectedKeys,
		unresolvedPlaceholders
	};
}

/**
 * Format an attribute value for inclusion in a prompt
 */
function formatAttributeValue(value: unknown): string {
	if (value === null || value === undefined) {
		return '';
	}

	if (Array.isArray(value)) {
		return value.map(formatAttributeValue).join(', ');
	}

	if (typeof value === 'object') {
		try {
			// Format objects as readable key-value pairs, not raw JSON
			const entries = Object.entries(value as Record<string, unknown>)
				.filter(([, v]) => v !== null && v !== undefined && v !== '')
				.map(
					([k, v]) =>
						`${k.replace(/_/g, ' ')}: ${typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v)}`
				);
			return entries.length > 0 ? entries.join(', ') : '';
		} catch {
			return '[object]';
		}
	}

	if (typeof value === 'boolean') {
		return value ? 'yes' : 'no';
	}

	return String(value);
}

// ============================================================================
// Placeholder Detection
// ============================================================================

/**
 * Extract all {{attribute_key}} placeholders from a prompt
 */
export function extractAttributePlaceholders(prompt: string): string[] {
	const placeholders = new Set<string>();
	const regex = /\{\{(\w+)\}\}/g;

	let match;
	while ((match = regex.exec(prompt)) !== null) {
		placeholders.add(match[1]);
	}

	return Array.from(placeholders);
}

/**
 * Check if a prompt contains any attribute placeholders
 */
export function hasAttributePlaceholders(prompt: string): boolean {
	return /\{\{\w+\}\}/.test(prompt);
}

/**
 * Validate that all placeholders in a prompt can be resolved
 */
export function validatePlaceholders(
	prompt: string,
	availableAttributes: string[]
): { valid: true } | { valid: false; missing: string[] } {
	const placeholders = extractAttributePlaceholders(prompt);
	const missing = placeholders.filter((p) => !availableAttributes.includes(p));

	if (missing.length === 0) {
		return { valid: true };
	}

	return { valid: false, missing };
}

// ============================================================================
// Chain Helpers
// ============================================================================

/**
 * Create a prompt by first interpolating template variables,
 * then injecting user attributes.
 *
 * This chains:
 * 1. interpolatePrompt(template, variables)
 * 2. injectAttributesIntoPrompt(result, attributes)
 */
export function buildPromptWithAttributes(
	template: string,
	variables: Record<string, unknown>,
	attributes: ResolvedAttributes,
	interpolateFn: (
		template: string,
		variables: Record<string, unknown>
	) => string = interpolatePrompt
): string {
	const interpolated = interpolateFn(template, variables);
	const injectionResult = injectAttributesIntoPrompt(interpolated, attributes);
	return injectionResult.result;
}
