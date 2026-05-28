/**
 * Onboarding Types
 *
 * Types for the onboarding session Durable Object
 */

// ============================================================================
// Question Types
// ============================================================================

export type LegacyQuestionType = 'checkbox' | 'multiselect';
export type NormalizedQuestionType =
	| 'single_select'
	| 'multi_select'
	| 'text'
	| 'number'
	| 'boolean';
export type QuestionType = LegacyQuestionType | NormalizedQuestionType;
export type OnboardingAnswerValue = string | number | boolean | string[];
export type ShowWhenOperator =
	| 'exists'
	| 'not_exists'
	| 'equals'
	| 'not_equals'
	| 'includes'
	| 'includes_any';

export interface ShowWhenCondition {
	questionId?: string;
	factKey?: string;
	operator: ShowWhenOperator;
	value?: OnboardingAnswerValue;
}

export interface ShowWhenRule {
	all?: ShowWhenCondition[];
	any?: ShowWhenCondition[];
}

export interface QuestionOption {
	value: string;
	label: string;
	icon?: string; // Phosphor icon e.g., 'ph:chart-line-up-duotone'
	description?: string;
	grantsTags?: string[];
}

export interface Question {
	id: string;
	factKey: string;
	factLabel: string;
	type: QuestionType;
	question: string;
	sidebarTitle: string;
	description?: string;
	options?: QuestionOption[];
	required: boolean;
	order?: number;
	enabled?: boolean;
	group?: string;
	showWhen?: ShowWhenRule | null;
	metadata?: Record<string, unknown> | null;
}

// ============================================================================
// Profiler Data (User Answers)
// ============================================================================

export interface ProfilerData {
	question_id: string;
	factKey: string;
	factLabel: string;
	question: string;
	answer: OnboardingAnswerValue;
}

export interface OnboardingAnswerRecord {
	questionId: string;
	factKey?: string;
	type: NormalizedQuestionType;
	value: OnboardingAnswerValue;
	displayValue: string;
	answeredAt: string;
}

export interface OnboardingTranscriptEvent {
	questionId: string;
	factKey?: string;
	phase: 'manual' | 'ai_personalized';
	prompt: string;
	answer: OnboardingAnswerValue;
	answerText: string;
	grantedTags: string[];
	createdAt: string;
}

// ============================================================================
// Session State
// ============================================================================

export type OnboardingPhase = 'preset' | 'ai-prompt' | 'ai-personalized' | 'completed';

export interface OnboardingSession {
	userId: string;
	assignmentId?: string;
	profileId?: string;
	phase: OnboardingPhase;
	status?:
		| 'in_progress'
		| 'extracting_profile'
		| 'completed'
		| 'profile_extraction_pending'
		| 'failed'
		| 'disclosure_pending'
		| 'paused';
	disclosureResponses?: Record<string, boolean>;
	currentQuestionNumber: number;
	currentQuestion: Question | null;
	profilerData: ProfilerData[];
	skippedQuestionIds?: string[];
	transcript?: OnboardingTranscriptEvent[];
	deterministicTags?: string[];
	aiAssignedTags?: string[];
	finalTags?: string[];
	profileExtractionStatus?: 'not_started' | 'running' | 'succeeded' | 'pending_retry' | 'failed';
	completedAt?: number;
	nextRetryAt?: number;
	enableAI: boolean;
	startedAt: number;
	lastActivityAt: number;
	/** Location captured from CF headers at session start - becomes "home" location */
	capturedLocation?: {
		country?: string;
		timezone?: string;
		continent?: string;
		city?: string;
	};
}

export interface OnboardingAgentState {
	session: OnboardingSession | null;
}

// ============================================================================
// Config (from config_onboarding table)
// ============================================================================

export type DisclosureItemType = 'acknowledgement' | 'accept_deny';

export interface DisclosureItem {
	id: string;
	question: string;
	title?: string;
	body?: string;
	type: DisclosureItemType;
	required: boolean;
	acceptLabel?: string;
	rejectLabel?: string;
	rejectMessage?: string;
}

export interface DisclosureConfig {
	enabled: boolean;
	items: DisclosureItem[];
}

export interface OnboardingConfig {
	id: string;
	system_prompt: string; // Relation ID to ai_prompts
	model: string; // Relation ID to ai_agent_models
	max_ai_questions: number;
	session_timeout_ms: number;
	cache_ttl_ms: number;
	enabled: boolean;
	defaultTags: string[];
	visibility: 'public' | 'invite_only' | 'hidden';
	disclosures?: DisclosureConfig;
	aiFallbackQuestions?: Question[];
	// Resolved relation data (flat, no expand nesting)
	promptTemplate: string | null;
	modelId: string | null; // The actual model identifier (e.g., 'gpt-4o')
	providerKey: 'cloudflare' | 'openai' | 'anthropic' | 'google' | 'xai' | null;
}

// ============================================================================
// Request/Response Types
// ============================================================================

export interface OnboardingStartRequest {
	userId: string;
	assignmentId?: string;
	profileId?: string;
	campaignId?: string;
	/** Cloudflare headers captured at session start for home location detection */
	cfHeaders?: {
		country?: string; // cf-ipcountry
		timezone?: string; // cf-timezone
		continent?: string; // cf-ipcontinent
		city?: string; // cf-ipcity
		latitude?: string; // cf-iplatitude
		longitude?: string; // cf-iplongitude
	};
}

export interface OnboardingAnswerRequest {
	userId: string;
	answer: unknown;
}

export interface OnboardingResponse {
	success: boolean;
	question?: Question;
	questionNumber?: number;
	phase?: OnboardingPhase;
	completed?: boolean;
	profilerData?: ProfilerData[];
	error?: string;
	rejectMessage?: string;
	disclosures?: DisclosureConfig;
	disclosuresPending?: boolean;
}

// ============================================================================
// AI Question Generation Schema (for Zod validation)
// ============================================================================

export interface AIGeneratedQuestion {
	question: Question;
	reasoning: string;
}

// ============================================================================
// Cache Types
// ============================================================================

export interface CachedQuestions {
	presetQuestions: Question[];
	fetchedAt: number;
}

export interface CachedConfig {
	config: OnboardingConfig;
	fetchedAt: number;
}
