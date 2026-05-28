/**
 * Tier Resolver — User plan gating for models, tools, and credit state.
 *
 * Loads the user's plan_packages record (with related models), checks
 * credit balance, and returns a UserTierContext used throughout the request
 * to enforce model/tool restrictions and zero-credit behavior.
 */

import type { Database } from '@repo/db/types';
import {
	planPackages,
	planPackagesAllowedModels,
	planPackagesAllowedTools,
	aiAgentModels,
	aiProviders,
	userTierOverrides
} from '@repo/db/schema';
import { eq, and } from 'drizzle-orm';
import { UserTierOverrideType } from '@repo/db/types';
import type { TagRule } from '@repo/shared/types';
import type { ResolvedModel } from '../types/flow';
import { getUserCreditBalance } from './billing';
import { evaluateTagRule } from './tag-rule-engine';
import { createLogger, formatError } from './logger';

// ============================================================================
// Types
// ============================================================================

type TierOverride = typeof userTierOverrides.$inferSelect;

export interface UserTierContext {
	planId: string;
	hasSubscription: boolean;
	allowedModelIds: Set<string>;
	allowedToolKeys: Set<string>;
	fallbackModel: ResolvedModel | null;
	hasCredits: boolean;
	creditBalance: number;
	overrides: TierOverride[];
	userTags: string[];
}

type EffectiveModelResult =
	| { blocked: false; modelId: string; degraded: boolean; reason?: string }
	| { blocked: true; reason: string };

// ============================================================================
// Core Resolution
// ============================================================================

/**
 * Resolve the full tier context for a user's plan.
 */
export async function resolveUserTier(
	db: Database,
	userId: string,
	planId: string | undefined,
	userTags: string[] = []
): Promise<UserTierContext> {
	const [planData, overrides, creditBalance] = await Promise.all([
		planId ? fetchPlanData(db, planId) : null,
		fetchOverrides(db, userId),
		getUserCreditBalance(db, userId)
	]);

	const allowedModelIds = new Set<string>();
	if (planData?.allowedModelIds) {
		for (const id of planData.allowedModelIds) {
			allowedModelIds.add(id);
		}
	}

	const allowedToolKeys = new Set<string>(planData?.allowedToolIds ?? []);

	const result: UserTierContext = {
		planId: planId ?? '',
		hasSubscription: planData?.isSubscription ?? false,
		allowedModelIds,
		allowedToolKeys,
		fallbackModel: planData?.fallbackModel ?? null,
		hasCredits: creditBalance > 0,
		creditBalance,
		overrides,
		userTags
	};

	return result;
}

// ============================================================================
// Gating Helpers
// ============================================================================

/** Check if a model is allowed by the user's tier (or overrides) and optional tag_rule. */
export function isModelAllowed(
	ctx: UserTierContext,
	modelRecordId: string,
	modelTagRule?: TagRule | null
): boolean {
	// Plan-based check
	let planAllowed = true;
	if (ctx.allowedModelIds.size > 0) {
		planAllowed =
			ctx.allowedModelIds.has(modelRecordId) ||
			ctx.overrides.some(
				(o) =>
					o.isActive &&
					o.overrideType === UserTierOverrideType.model &&
					o.targetId === modelRecordId &&
					(!o.expiresAt || new Date(o.expiresAt) > new Date())
			);
	}
	if (!planAllowed) return false;

	// Tag-rule check (layered on top of plan gating)
	if (modelTagRule) {
		return evaluateTagRule(modelTagRule, ctx.userTags);
	}

	return true;
}

/** Check if a tool is allowed by the user's tier (or overrides). Empty set = all allowed. */
export function isToolAllowed(ctx: UserTierContext, toolId: string): boolean {
	if (ctx.allowedToolKeys.size === 0) return true;
	if (ctx.allowedToolKeys.has(toolId)) return true;
	return ctx.overrides.some(
		(o) =>
			o.isActive &&
			o.overrideType === UserTierOverrideType.tool &&
			o.targetId === toolId &&
			(!o.expiresAt || new Date(o.expiresAt) > new Date())
	);
}

/**
 * Determine the effective model given tier + credit state.
 *
 * - Credits > 0: returns requested model if tier-allowed, else systemDefaultId.
 * - Credits = 0 + subscriber: forces fallbackModel (degraded mode).
 * - Credits = 0 + no subscription: blocked — caller must not proceed.
 */
export function getEffectiveModel(
	ctx: UserTierContext,
	requestedModelId: string,
	systemDefaultId: string
): EffectiveModelResult {
	// No credits + no subscription → hard block
	if (!ctx.hasCredits && !ctx.hasSubscription) {
		return { blocked: true, reason: 'credits_exhausted_no_subscription' };
	}

	// No credits + subscriber → degrade to fallback
	if (!ctx.hasCredits && ctx.hasSubscription) {
		if (!ctx.fallbackModel) {
			return { blocked: true, reason: 'no_fallback_model_configured' };
		}
		return {
			blocked: false,
			modelId: ctx.fallbackModel.id,
			degraded: true,
			reason: 'credits_exhausted_subscriber'
		};
	}

	// Has credits → use requested if allowed, else system default
	const effectiveId = isModelAllowed(ctx, requestedModelId) ? requestedModelId : systemDefaultId;
	return { blocked: false, modelId: effectiveId, degraded: false };
}

/**
 * Quick credit-gate check for endpoints (e.g. /models).
 * Returns credit state + subscription status without full tier resolution.
 */
export async function checkCreditGate(
	db: Database,
	userId: string,
	planId: string | undefined
): Promise<{ hasCredits: boolean; balance: number; hasSubscription: boolean }> {
	const [balance, plan] = await Promise.all([
		getUserCreditBalance(db, userId),
		planId
			? db.query.planPackages
					.findFirst({
						where: eq(planPackages.id, planId),
						columns: { isSubscription: true }
					})
					.catch((err) => {
						createLogger('TierResolver').warn('fetch_plan_subscription_failed', {
							planId,
							...formatError(err)
						});
						return null;
					})
			: null
	]);

	return {
		hasCredits: balance > 0,
		balance,
		hasSubscription: plan?.isSubscription ?? false
	};
}

// ============================================================================
// Database Fetchers (private)
// ============================================================================

interface PlanData {
	isSubscription: boolean;
	allowedModelIds: string[];
	allowedToolIds: string[];
	fallbackModel: ResolvedModel | null;
}

async function fetchPlanData(db: Database, planId: string): Promise<PlanData | null> {
	try {
		const [plan] = await db.select().from(planPackages).where(eq(planPackages.id, planId)).limit(1);

		if (!plan) return null;

		// Fetch allowed models (M2M)
		const allowedModelRows = await db
			.select({ targetId: planPackagesAllowedModels.targetId })
			.from(planPackagesAllowedModels)
			.where(eq(planPackagesAllowedModels.sourceId, planId));
		const allowedModelIds = allowedModelRows.map((r) => r.targetId);

		// Fetch allowed tools (M2M)
		const allowedToolRows = await db
			.select({ targetId: planPackagesAllowedTools.targetId })
			.from(planPackagesAllowedTools)
			.where(eq(planPackagesAllowedTools.sourceId, planId));
		const allowedToolIds = allowedToolRows.map((r) => r.targetId);

		// Fetch fallback model with provider
		let fallbackModel: ResolvedModel | null = null;
		if (plan.fallbackModel) {
			const [row] = await db
				.select({ model: aiAgentModels, provider: aiProviders })
				.from(aiAgentModels)
				.leftJoin(aiProviders, eq(aiAgentModels.provider, aiProviders.id))
				.where(eq(aiAgentModels.id, plan.fallbackModel))
				.limit(1);

			if (row) {
				const m = row.model;
				const p = row.provider;
				fallbackModel = {
					id: m.id,
					model_id: m.modelId ?? '',
					display_name: m.displayName ?? '',
					provider_id: m.provider ?? '',
					provider_key: p?.providerKey ?? 'unknown',
					pricing_id: m.currentPricing || undefined,
					context_window: m.contextWindow ? Number(m.contextWindow) : undefined,
					max_output_tokens: m.maxOutputTokens ? Number(m.maxOutputTokens) : undefined,
					default_options: (m.defaultOptions as Record<string, unknown>) ?? undefined,
					capabilities: (m.capabilities as Record<string, unknown>) ?? undefined,
					tag_rule: (m.tagRule as any) ?? null
				};
			}
		}

		return {
			isSubscription: plan.isSubscription ?? false,
			allowedModelIds,
			allowedToolIds,
			fallbackModel
		};
	} catch (err) {
		createLogger('TierResolver').warn('fetch_plan_data_failed', { planId, ...formatError(err) });
		return null;
	}
}

async function fetchOverrides(db: Database, userId: string): Promise<TierOverride[]> {
	try {
		return await db
			.select()
			.from(userTierOverrides)
			.where(and(eq(userTierOverrides.user, userId), eq(userTierOverrides.isActive, true)));
	} catch (err) {
		createLogger('TierResolver').warn('fetch_overrides_failed', { userId, ...formatError(err) });
		return [];
	}
}
