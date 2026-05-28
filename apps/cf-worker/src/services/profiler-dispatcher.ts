/**
 * Profiler Dispatcher
 *
 * Routes extraction work to the applicable profiler agents for a given message
 * batch using tag-based matching against the user's effective tags.
 *
 * Algorithm:
 * 1. Load all active profiler agents
 * 2. Score each profiler by tag overlap with user tags
 * 3. Use priority as tiebreaker (lower number = higher priority)
 * 4. Null tagRule = fallback profiler (score 0, only selected when no tags match)
 * 5. Seed each profiler with preferred schema sections while allowing discovered fields/sections
 */

import type { Database } from '@repo/db/types';
import type { Env } from '../types';
import type { FlowCostTracker } from '../types/flow';
import type { MessagePair } from './session-summarizer';
import { createProfilerService } from './profiler-service';
import { createLogger, formatError } from '../utils/logger';
import { buildProfilerPlanForTags, loadActiveProfilers } from './profiler-routing';
import { loadGlobalProfileSchema } from '../utils/schema-loader';
import type { ProfileSchemaSection, ProfilerPlanItem } from '../types/profiler';

// ============================================================================
// Types
// ============================================================================

export interface DispatcherContext {
	env: Env;
	db: Database;
	userId: string;
	sessionId: string;
	agentId: string;
	costTracker?: FlowCostTracker;
	/** Effective tags for the current user (plan-granted + stored) */
	userTags: string[];
	/** Source of the extraction batch. Defaults to chat. */
	source?: 'onboarding' | 'chat';
}

// ============================================================================
// Dispatcher
// ============================================================================

export class ProfilerDispatcher {
	private ctx: DispatcherContext;
	private log;

	constructor(ctx: DispatcherContext) {
		this.ctx = ctx;
		this.log = createLogger('ProfilerDispatcher', { userId: ctx.userId });
	}

	/**
	 * Dispatch extraction for a message batch to the best profiler.
	 */
	async dispatch(messages: MessagePair[]): Promise<void> {
		if (messages.length === 0) return;

		const profilers = await loadActiveProfilers(this.ctx.db);
		if (profilers.length === 0) {
			this.log.warn('no_active_profilers');
			return;
		}

		const schema = await loadGlobalProfileSchema(this.ctx.db);
		const plan = buildProfilerPlanForTags(profilers, schema, this.ctx.userTags, this.ctx.userId);
		if (plan.items.length === 0) {
			this.log.warn('profiler_plan_empty', {
				warnings: plan.warnings,
				userTagCount: this.ctx.userTags.length
			});
			return;
		}

		this.log.info('dispatch_decision', {
			totalProfilers: profilers.length,
			selected: plan.items.map((item) => ({
				name: item.name,
				score: item.score,
				scope: item.scope,
				ownedSections: item.ownedSections
			})),
			userTagCount: this.ctx.userTags.length
		});

		for (const item of plan.items) {
			const ownedSchema = plan.visibleSchema.filter((section) =>
				item.ownedSections.includes(section.section_id)
			);

			try {
				await this.runProfiler(item, ownedSchema, messages);
			} catch (e) {
				this.log.error('profiler_dispatch_failed', {
					profiler: item.name,
					profilerAgentId: item.profilerAgentId,
					...formatError(e)
				});
			}
		}
	}

	private async runProfiler(
		planItem: ProfilerPlanItem,
		schema: ProfileSchemaSection[],
		messages: MessagePair[]
	): Promise<void> {
		const service = createProfilerService({
			env: this.ctx.env,
			db: this.ctx.db,
			userId: this.ctx.userId,
			sessionId: this.ctx.sessionId,
			agentId: this.ctx.agentId,
			profilerAgentId: planItem.profilerAgentId,
			costTracker: this.ctx.costTracker
		});
		const source = this.ctx.source ?? 'chat';

		const extractionSchema = schema.map((section) => ({
			sectionId: section.section_id,
			fields: section.fields.map((field) => ({
				key: field.key,
				label: field.label,
				type:
					field.type === 'number'
						? ('number' as const)
						: field.type === 'list'
							? ('array' as const)
							: ('string' as const)
			}))
		}));

		const ranStructured = await service.extractStructured(messages, extractionSchema, {
			source,
			fullSchema: schema
		});

		if (!ranStructured) {
			await service.updateProfile(messages, {
				source,
				schema,
				ownedSectionIds: planItem.ownedSections
			});
		}
	}
}

// ============================================================================
// Factory
// ============================================================================

export function createProfilerDispatcher(ctx: DispatcherContext): ProfilerDispatcher {
	return new ProfilerDispatcher(ctx);
}
