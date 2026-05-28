import type { LanguageModel } from 'ai';
import type { Database } from '@repo/db/types';
import type { Env } from '../types';
import type { OnboardingConfig, ProfilerData, Question } from '../types/onboarding';
import {
	clearConfigCache,
	getModel,
	getModelConfigWithFallback,
	getModelFromConfig,
	type InfraModelConfig
} from './model-factory';
import { clearModelResolverCache, getSystemDefaultModel } from './model-resolver';
import { ConfigError } from './errors';

// ============================================================================
// AI Question Model Resolution
// ============================================================================

const ONBOARDING_AI_QUESTION_MODEL_CONFIG_KEY = 'onboarding_ai_question_model';

export type OnboardingAIQuestionModelSource = 'profile_config' | 'system_default' | 'infra_config';

export interface ResolvedOnboardingAIQuestionModel {
	model: LanguageModel;
	provider: string;
	modelName: string;
	source: OnboardingAIQuestionModelSource;
	modelConfig?: InfraModelConfig;
}

export function clearOnboardingAIQuestionModelCache(): void {
	clearModelResolverCache();
	clearConfigCache();
}

export async function resolveOnboardingAIQuestionModel(options: {
	db: Database;
	env: Env;
	config: OnboardingConfig;
}): Promise<ResolvedOnboardingAIQuestionModel> {
	const profileProvider = options.config.providerKey?.trim();
	const profileModel = options.config.modelId?.trim();

	if (profileProvider && profileModel) {
		return {
			model: getModel(profileProvider, profileModel, options.env),
			provider: profileProvider,
			modelName: profileModel,
			source: 'profile_config'
		};
	}

	try {
		const systemDefault = await getSystemDefaultModel(options.db);
		return {
			model: getModel(systemDefault.provider_key, systemDefault.model_id, options.env),
			provider: systemDefault.provider_key,
			modelName: systemDefault.model_id,
			source: 'system_default'
		};
	} catch (error) {
		if (!(error instanceof ConfigError) || error.code !== 'NO_SYSTEM_DEFAULT_MODEL') {
			throw error;
		}
	}

	const modelConfig = await getModelConfigWithFallback(
		options.db,
		ONBOARDING_AI_QUESTION_MODEL_CONFIG_KEY
	);

	return {
		model: getModelFromConfig(modelConfig, options.env),
		provider: modelConfig.providerConfig?.provider_key ?? 'unknown',
		modelName: modelConfig.model_id,
		source: 'infra_config',
		modelConfig
	};
}

// ============================================================================
// Fallback Question Selection
// ============================================================================

const NEUTRAL_FALLBACK_AI_QUESTIONS: Question[] = [
	{
		id: 'fallback_current_priority',
		factKey: 'current_priority',
		factLabel: 'Current Priority',
		type: 'checkbox',
		question: 'What would be most useful for us to help you with next?',
		sidebarTitle: 'Priority',
		description: 'Choose the kind of support that would make this guidance more useful.',
		required: true,
		options: [
			{ value: 'clear_plan', label: 'A clear next-step plan', icon: 'ph:list-checks-duotone' },
			{ value: 'focus_areas', label: 'Understanding what to improve', icon: 'ph:target-duotone' },
			{
				value: 'consistency',
				label: 'Building better consistency',
				icon: 'ph:calendar-check-duotone'
			},
			{ value: 'progress_tracking', label: 'Tracking progress', icon: 'ph:chart-line-up-duotone' }
		]
	},
	{
		id: 'fallback_support_needs',
		factKey: 'support_needs',
		factLabel: 'Support Needs',
		type: 'multiselect',
		question: 'What kind of support would help you most right now?',
		sidebarTitle: 'Support',
		description: 'Select all that apply.',
		required: true,
		options: [
			{ value: 'planning', label: 'Planning and scheduling', icon: 'ph:calendar-duotone' },
			{ value: 'clarity', label: 'Concept clarity', icon: 'ph:lightbulb-duotone' },
			{ value: 'feedback', label: 'Practice feedback', icon: 'ph:clipboard-text-duotone' },
			{
				value: 'accountability',
				label: 'Motivation and accountability',
				icon: 'ph:handshake-duotone'
			},
			{ value: 'stress_management', label: 'Stress management', icon: 'ph:heartbeat-duotone' }
		]
	},
	{
		id: 'fallback_additional_context',
		factKey: 'additional_context',
		factLabel: 'Additional Context',
		type: 'checkbox',
		question: 'How would you prefer to receive guidance from here?',
		sidebarTitle: 'Guidance Style',
		description: 'This helps us shape the recommendations in a way that is easier to act on.',
		required: true,
		options: [
			{ value: 'step_by_step', label: 'Step-by-step plan', icon: 'ph:steps-duotone' },
			{ value: 'quick_tips', label: 'Short practical tips', icon: 'ph:lightning-duotone' },
			{
				value: 'detailed_explanations',
				label: 'Detailed explanations',
				icon: 'ph:book-open-duotone'
			},
			{ value: 'check_ins', label: 'Regular progress check-ins', icon: 'ph:checks-duotone' }
		]
	}
];

export function selectFallbackAIQuestion(
	profilerData: Array<Pick<ProfilerData, 'factKey'>> = [],
	fallbackQuestions: Question[] = NEUTRAL_FALLBACK_AI_QUESTIONS
): Question | null {
	const answeredKeys = new Set(profilerData.map((entry) => entry.factKey));
	const question = fallbackQuestions.find((item) => !answeredKeys.has(item.factKey));

	return question ? structuredClone(question) : null;
}

const LEGACY_FINANCE_FALLBACK_FACT_KEYS = new Set([
	'investment_timeline',
	'risk_tolerance',
	'primary_financial_goals'
]);

const LEGACY_FINANCE_FALLBACK_PATTERN =
	/investment|portfolio|financial goals|retirement|risk tolerance/i;

export function isLegacyFinanceFallbackQuestion(question: Question | null | undefined): boolean {
	if (!question) return false;
	if (LEGACY_FINANCE_FALLBACK_FACT_KEYS.has(question.factKey)) return true;

	return LEGACY_FINANCE_FALLBACK_PATTERN.test(
		[
			question.id,
			question.factKey,
			question.factLabel,
			question.question,
			question.description,
			...(question.options ?? []).flatMap((option) => [
				option.value,
				option.label,
				option.description
			])
		]
			.filter(Boolean)
			.join(' ')
	);
}
