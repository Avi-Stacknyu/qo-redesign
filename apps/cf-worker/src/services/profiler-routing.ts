import type { Database } from '@repo/db/types';
import { profilerAgents } from '@repo/db/schema';
import { eq } from 'drizzle-orm';
import type { TagRule } from '@repo/shared/types';
import type {
	ProfileSchemaSection,
	ProfilerPlan,
	ProfilerPlanItem,
	ProfilerScope
} from '../types/profiler';
import { scoreTagOverlap } from '../utils/tag-rule-engine';
import { loadGlobalProfileSchema } from '../utils/schema-loader';
import { resolveUserTags } from '../utils/resolve-user-tags';

export type ProfilerRouteRecord = typeof profilerAgents.$inferSelect;

export interface RankedProfiler {
	record: ProfilerRouteRecord;
	score: number;
	isFallback: boolean;
}

function isFallbackRule(rule: TagRule | null | undefined): boolean {
	return !rule || !rule.groups || rule.groups.length === 0;
}

export function normalizeFocusSections(focusSections: unknown): string[] {
	if (!Array.isArray(focusSections)) return [];

	const normalized = focusSections
		.filter((section): section is string => typeof section === 'string')
		.map((section) => section.trim())
		.filter((section) => section.length > 0);

	return [...new Set(normalized)];
}

export function rankProfilersForTags(
	profilers: ProfilerRouteRecord[],
	userTags: string[]
): RankedProfiler[] {
	const ranked = profilers.map((profiler) => {
		const rule = profiler.tagRule as TagRule | null;
		return {
			record: profiler,
			score: scoreTagOverlap(rule, userTags),
			isFallback: isFallbackRule(rule)
		};
	});

	const hasAnyMatch = ranked.some((profiler) => profiler.score > 0);

	return ranked.sort((left, right) => {
		if (hasAnyMatch) {
			if (right.score !== left.score) return right.score - left.score;
		} else if (left.isFallback !== right.isFallback) {
			return left.isFallback ? -1 : 1;
		}

		const leftPriority = left.record.priority ?? 50;
		const rightPriority = right.record.priority ?? 50;
		return leftPriority - rightPriority;
	});
}

export function selectProfilerForTags(
	profilers: ProfilerRouteRecord[],
	userTags: string[]
): RankedProfiler | null {
	return rankProfilersForTags(profilers, userTags)[0] ?? null;
}

function profilerId(record: ProfilerRouteRecord): string {
	return String(record.id);
}

function profilerName(record: ProfilerRouteRecord): string {
	return String(record.name ?? record.id);
}

function profilerPriority(record: ProfilerRouteRecord): number {
	return Number(record.priority ?? 50);
}

function compareCandidates(
	left: RankedProfiler,
	right: RankedProfiler,
	preferSpecialist = true
): number {
	if (preferSpecialist && left.isFallback !== right.isFallback) return left.isFallback ? 1 : -1;
	if (right.score !== left.score) return right.score - left.score;
	const priorityDiff = profilerPriority(left.record) - profilerPriority(right.record);
	if (priorityDiff !== 0) return priorityDiff;
	return profilerId(left.record).localeCompare(profilerId(right.record));
}

function createPlanItem(
	ranked: RankedProfiler,
	scope: ProfilerScope,
	ownedSections: string[]
): ProfilerPlanItem {
	return {
		profilerAgentId: profilerId(ranked.record),
		name: profilerName(ranked.record),
		scope,
		score: ranked.score,
		priority: profilerPriority(ranked.record),
		focusSections: normalizeFocusSections(ranked.record.focusSections),
		ownedSections
	};
}

export function buildProfilerPlanForTags(
	profilers: ProfilerRouteRecord[],
	schema: ProfileSchemaSection[],
	userTags: string[],
	userId: string
): ProfilerPlan {
	const warnings: string[] = [];
	if (profilers.length === 0) warnings.push('no_active_profilers');
	if (schema.length === 0) warnings.push('no_profile_schema');

	const schemaIds = new Set(schema.map((section) => section.section_id));
	const ranked = profilers
		.map((profiler) => {
			const rule = profiler.tagRule as TagRule | null;
			return {
				record: profiler,
				score: scoreTagOverlap(rule, userTags),
				isFallback: isFallbackRule(rule)
			};
		})
		.filter((item) => item.isFallback || item.score > 0)
		.sort(compareCandidates);

	if (ranked.length === 0) warnings.push('no_applicable_profilers');

	const sectionOwners: Record<string, string> = {};
	const ownedByProfiler = new Map<string, Set<string>>();

	for (const section of schema) {
		const sectionId = section.section_id;
		const candidates = ranked.filter((item) => {
			const focus = normalizeFocusSections(item.record.focusSections);
			return focus.length === 0 || focus.includes(sectionId);
		});
		if (candidates.length === 0) continue;

		const specialists = candidates.filter((item) => !item.isFallback);
		const globals = candidates.filter((item) => item.isFallback);
		const owner = (specialists.length > 0 ? specialists : globals).sort(compareCandidates)[0];
		if (!owner) continue;

		const ownerId = profilerId(owner.record);
		sectionOwners[sectionId] = ownerId;
		if (!ownedByProfiler.has(ownerId)) ownedByProfiler.set(ownerId, new Set());
		ownedByProfiler.get(ownerId)!.add(sectionId);
	}

	for (const item of ranked) {
		const focus = normalizeFocusSections(item.record.focusSections);
		const missing = focus.filter((sectionId) => !schemaIds.has(sectionId));
		if (missing.length > 0)
			warnings.push(`unknown_focus_sections:${profilerId(item.record)}:${missing.join(',')}`);
	}

	const items = ranked
		.map((item) =>
			createPlanItem(item, item.isFallback ? 'global' : 'specialist', [
				...(ownedByProfiler.get(profilerId(item.record)) ?? [])
			])
		)
		.filter((item) => item.ownedSections.length > 0)
		.sort((left, right) => {
			if (left.scope !== right.scope) return left.scope === 'global' ? -1 : 1;
			if (right.score !== left.score) return right.score - left.score;
			if (left.priority !== right.priority) return left.priority - right.priority;
			return left.profilerAgentId.localeCompare(right.profilerAgentId);
		});

	const visibleSchema = schema.filter((section) => sectionOwners[section.section_id]);

	return {
		userId,
		userTags,
		items,
		sectionOwners,
		visibleSchema,
		warnings
	};
}

export function filterSchemaByFocusSections(
	schema: ProfileSchemaSection[],
	focusSections: unknown
): ProfileSchemaSection[] {
	const normalizedFocus = normalizeFocusSections(focusSections);
	if (normalizedFocus.length === 0) return schema;

	const allowed = new Set(normalizedFocus);
	return schema.filter((section) => allowed.has(section.section_id));
}

export async function loadActiveProfilers(db: Database): Promise<ProfilerRouteRecord[]> {
	return db.query.profilerAgents.findMany({
		where: eq(profilerAgents.status, 'active')
	});
}

export async function resolveProfilerForUser(
	db: Database,
	userTags: string[]
): Promise<RankedProfiler | null> {
	const profilers = await loadActiveProfilers(db);
	return selectProfilerForTags(profilers, userTags);
}

export async function resolveProfilerPlanForUser(
	db: Database,
	userId: string
): Promise<ProfilerPlan> {
	const [profilers, schema, userTags] = await Promise.all([
		loadActiveProfilers(db),
		loadGlobalProfileSchema(db),
		resolveUserTags(userId, db)
	]);
	return buildProfilerPlanForTags(profilers, schema, userTags, userId);
}
