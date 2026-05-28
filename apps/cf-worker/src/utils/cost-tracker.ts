/**
 * Inference Cost Tracker
 *
 * Consolidates the repeated pattern of:
 *   getConfigPricing → computeInferenceCost → getCreditsPerUsd → record/track event
 *
 * Supports two recording modes:
 *   - costTracker: accumulates event into a FlowCostTracker (flushed to DB later)
 *   - recordContext: writes event to DB immediately via recordCostEventsFromArray
 */

import type { Database } from '@repo/db/types';
import type { FlowCostTracker } from '../types/flow';
import type { InfraModelConfig, PricingRate } from './model-factory';
import { getConfigPricing } from './model-factory';
import {
	computeInferenceCost,
	extraTokenMeta,
	getCreditsPerUsd,
	recordCostEventsFromArray
} from './billing';

// ============================================================================
// Types
// ============================================================================

export interface TrackCostParams {
	db: Database;
	/** InfraModelConfig — model_id and pricing resolved automatically */
	modelConfig?: InfraModelConfig;
	/** Explicit model ID when InfraModelConfig is not available (e.g. flow-executor) */
	modelId?: string;
	/** AI SDK usage object */
	usage: {
		inputTokens?: number;
		outputTokens?: number;
		cachedTokens?: number;
		reasoningTokens?: number;
	};
	/** Purpose label for metadata (e.g. 'note_categorization', 'title_generation') */
	purpose: string;
	/** Override pricing. When undefined, getConfigPricing(modelConfig) is used. */
	pricing?: PricingRate | null;
	/** Pre-resolved creditsPerUsd to skip DB lookup */
	creditsPerUsd?: number;
	/** Accumulate event into a cost tracker (events flushed to DB later) */
	costTracker?: FlowCostTracker;
	/** Write event to DB directly via recordCostEventsFromArray */
	recordContext?: { userId: string; messageId: string; chatId?: string };
	/** Extra metadata fields merged into event.metadata */
	extraMetadata?: Record<string, unknown>;
}

export interface TrackCostResult {
	costUsd: number;
	credits: number;
	tokens: { input: number; output: number; cached: number; reasoning: number };
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Compute inference cost and record/track the event in a single call.
 *
 * Provide `costTracker` to accumulate into a FlowCostTracker, or
 * `recordContext` to write directly to the token/credit ledgers.
 */
export async function trackInferenceCost(params: TrackCostParams): Promise<TrackCostResult> {
	const resolvedModelId = params.modelId ?? params.modelConfig?.model_id ?? '';

	// Resolve pricing: explicit override > getConfigPricing(modelConfig) > null
	const pricing =
		params.pricing !== undefined
			? params.pricing
			: params.modelConfig
				? getConfigPricing(params.modelConfig)
				: null;

	const { costUsd, tokens } = computeInferenceCost(pricing, params.usage);
	const creditsPerUsd = params.creditsPerUsd ?? (await getCreditsPerUsd(params.db));
	const credits = costUsd * creditsPerUsd;

	const event = {
		operation: 'inference' as const,
		modelId: resolvedModelId,
		tokens: { input: tokens.input, output: tokens.output },
		costUsd,
		credits,
		pricingRateId: pricing?.id,
		metadata: {
			purpose: params.purpose,
			...extraTokenMeta(tokens),
			...params.extraMetadata
		}
	};

	if (params.costTracker) {
		params.costTracker.addEvent(event);
	} else if (params.recordContext) {
		await recordCostEventsFromArray(params.db, [event], params.recordContext);
	}

	return { costUsd, credits, tokens };
}
