/**
 * Profiler System Types
 *
 * Types for the hybrid schema profiler system that replaces flat FACT extraction
 * with structured, categorized user profile sections.
 *
 * Two-tier field system:
 * - Tier 1 (Schema fields): Admin-defined keys with stable identifiers
 * - Tier 2 (Discovered fields): LLM-generated at runtime, flagged isSchema: false
 */

// ============================================================================
// Profile Field & Section Data (stored in graph node data)
// ============================================================================

/** Single field value stored in a profile section node */
export interface ProfileFieldValue {
	value: string;
	/** Display label (from schema definition or LLM-generated for discovered fields) */
	label: string;
	/** Confidence score 0-1 (1.0 for user-provided, 0.8 for chat-extracted) */
	confidence: number;
	source: 'onboarding' | 'chat' | 'user_edit';
	/** true = admin-defined schema key, false = LLM-discovered at runtime */
	isSchema: boolean;
	/** ISO timestamp of last update */
	updatedAt: string;
}

/** Data stored in a PROFILE_SECTION graph node's `data` field */
export interface ProfileSectionData {
	/** Section display label, e.g. "Personal Information" */
	label: string;
	/** Lucide icon name for UI display */
	icon: string;
	/** Sort order for section display */
	order: number;
	/** Map of fieldKey → ProfileFieldValue */
	fields: Record<string, ProfileFieldValue>;
}

// ============================================================================
// Profiler LLM Result (what the profiler LLM returns)
// ============================================================================

/** Shape of a single field update from the profiler LLM */
export interface ProfilerFieldUpdate {
	value: string;
	/** Required for newly discovered fields; optional for schema field updates */
	label?: string;
}

/** What the profiler LLM returns after analyzing messages */
export interface ProfilerResult {
	updates: Array<{
		/** section_id from schema, e.g. "personal", "financial" */
		section: string;
		/** Map of fieldKey → update value */
		fields: Record<string, ProfilerFieldUpdate>;
	}>;
}

// ============================================================================
// Profile Schema (admin-defined, stored on profiler_agents PB record)
// ============================================================================

/** Individual field definition within a schema section */
export interface ProfileSchemaField {
	/** Stable snake_case key, e.g. "age", "annual_income" */
	key: string;
	/** Human-readable display label */
	label: string;
	type: 'text' | 'number' | 'date' | 'list';
	/** Hint for LLM: what this field represents */
	description?: string;
}

/** Section definition within a profiler schema */
export interface ProfileSchemaSection {
	/** Unique section identifier, e.g. "personal", "financial" */
	section_id: string;
	/** Display label, e.g. "Personal Information" */
	label: string;
	/** Lucide icon name for UI */
	icon: string;
	/** Sort order */
	order: number;
	/** Fields defined in this section */
	fields: ProfileSchemaField[];
}

export type ProfilerScope = 'global' | 'specialist';

export interface ProfilerPlanItem {
	profilerAgentId: string;
	name: string;
	scope: ProfilerScope;
	score: number;
	priority: number;
	focusSections: string[];
	ownedSections: string[];
}

export interface ProfilerPlan {
	userId: string;
	userTags: string[];
	items: ProfilerPlanItem[];
	sectionOwners: Record<string, string>;
	visibleSchema: ProfileSchemaSection[];
	warnings: string[];
}

/**
 * Normalize a raw schema array from PB — handles both `id` and `section_id` keys.
 * PB data may store the section identifier as `id` (from LLM generation) or `section_id`.
 */
export function normalizeSchema(raw: unknown): ProfileSchemaSection[] {
	if (!Array.isArray(raw)) return [];
	return raw
		.filter((s) => s && typeof s === 'object')
		.map((s: Record<string, unknown>) => ({
			section_id: (s.section_id ?? s.id ?? '') as string,
			label: (s.label ?? '') as string,
			icon: (s.icon ?? 'user') as string,
			order: (s.order ?? 99) as number,
			fields: Array.isArray(s.fields) ? s.fields : []
		}))
		.filter((s) => s.section_id !== '');
}

// ============================================================================
// Profiler Agent Record (PB collection: profiler_agents)
// ============================================================================

/** Shape of records in the `profiler_agents` table */
export interface ProfilerAgentRecord {
	id: string;
	/** e.g. "Finance Profiler", "General Profiler" */
	name: string;
	/** Admin-facing description */
	description?: string;
	status: 'active' | 'inactive';
	/** The full profiler instruction prompt (self-contained, not a relation) */
	system_prompt: string;
	/** Relation ID to ai_agent_models */
	model: string;
	/** LLM output token limit */
	max_tokens?: number;

	// ---- Routing metadata (used by profiler dispatcher) ----

	/** Tag rule for matching users — null means fallback profiler */
	tag_rule?: import('@repo/shared/types').TagRule | null;
	/** Section IDs this profiler extracts from the global schema */
	focus_sections?: string[];
	/** Dispatch priority (lower = higher priority). Default 50. */
	priority?: number;
}
