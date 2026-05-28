import { describe, expect, it } from 'vitest';
import type { ProfileSchemaSection } from '../../types/profiler';
import {
	buildProfilerPlanForTags,
	filterSchemaByFocusSections,
	rankProfilersForTags,
	selectProfilerForTags,
	type ProfilerRouteRecord
} from '../profiler-routing';

function createProfiler(overrides: Partial<ProfilerRouteRecord>): ProfilerRouteRecord {
	return {
		id: 'profiler-default',
		name: 'Default Profiler',
		description: null,
		status: 'active',
		systemPrompt: 'Extract profile data',
		model: null,
		maxTokens: null,
		created: null,
		updated: null,
		focusSections: null,
		priority: 50,
		tagRule: null,
		...overrides
	};
}

const schema: ProfileSchemaSection[] = [
	{
		section_id: 'personal',
		label: 'Personal',
		icon: 'user',
		order: 1,
		fields: [{ key: 'name', label: 'Name', type: 'text' }]
	},
	{
		section_id: 'medical',
		label: 'Medical',
		icon: 'heart-pulse',
		order: 2,
		fields: [{ key: 'conditions', label: 'Conditions', type: 'list' }]
	},
	{
		section_id: 'compliance',
		label: 'Compliance',
		icon: 'shield-check',
		order: 3,
		fields: [{ key: 'licenses', label: 'Licenses', type: 'list' }]
	}
];

describe('profiler-routing', () => {
	it('prefers the profiler with the highest tag overlap', () => {
		const profilers = [
			createProfiler({
				id: 'fallback',
				name: 'Fallback',
				priority: 100
			}),
			createProfiler({
				id: 'medical',
				name: 'Medical',
				priority: 20,
				tagRule: { groups: [{ tags: ['segment:medical', 'role:doctor'] }] }
			}),
			createProfiler({
				id: 'finance',
				name: 'Finance',
				priority: 10,
				tagRule: { groups: [{ tags: ['segment:finance'] }] }
			})
		];

		const selected = selectProfilerForTags(profilers, ['segment:medical', 'role:doctor']);

		expect(selected?.record.id).toBe('medical');
		expect(selected?.score).toBe(2);
	});

	it('falls back to the ungated profiler when no tags match', () => {
		const profilers = [
			createProfiler({
				id: 'finance',
				name: 'Finance',
				priority: 10,
				tagRule: { groups: [{ tags: ['segment:finance'] }] }
			}),
			createProfiler({
				id: 'fallback',
				name: 'Fallback',
				priority: 99
			})
		];

		const selected = selectProfilerForTags(profilers, ['segment:medical']);

		expect(selected?.record.id).toBe('fallback');
		expect(selected?.isFallback).toBe(true);
	});

	it('uses priority as the tie-breaker for equally matched profilers', () => {
		const profilers = [
			createProfiler({
				id: 'medical-low-priority',
				priority: 40,
				tagRule: { groups: [{ tags: ['segment:medical'] }] }
			}),
			createProfiler({
				id: 'medical-high-priority',
				priority: 5,
				tagRule: { groups: [{ tags: ['segment:medical'] }] }
			})
		];

		const ranked = rankProfilersForTags(profilers, ['segment:medical']);

		expect(ranked[0]?.record.id).toBe('medical-high-priority');
		expect(ranked[1]?.record.id).toBe('medical-low-priority');
	});

	it('filters schema sections to the selected profiler focus sections', () => {
		const filtered = filterSchemaByFocusSections(schema, ['medical', 'compliance']);

		expect(filtered.map((section) => section.section_id)).toEqual(['medical', 'compliance']);
	});

	it('returns the full schema when focus sections are empty or invalid', () => {
		expect(filterSchemaByFocusSections(schema, null)).toEqual(schema);
		expect(filterSchemaByFocusSections(schema, [])).toEqual(schema);
		expect(filterSchemaByFocusSections(schema, ['medical', '', 'medical'])).toEqual([schema[1]]);
	});

	it('builds a plan with global sections plus matched specialist sections', () => {
		const profilers = [
			createProfiler({
				id: 'global',
				name: 'Global',
				priority: 50,
				focusSections: ['personal', 'compliance']
			}),
			createProfiler({
				id: 'doctor',
				name: 'Doctor',
				priority: 10,
				focusSections: ['medical'],
				tagRule: { groups: [{ tags: ['role:doctor'] }] }
			})
		];

		const plan = buildProfilerPlanForTags(profilers, schema, ['role:doctor'], 'user-1');

		expect(plan.visibleSchema.map((section) => section.section_id)).toEqual([
			'personal',
			'medical',
			'compliance'
		]);
		expect(plan.sectionOwners).toEqual({
			personal: 'global',
			medical: 'doctor',
			compliance: 'global'
		});
		expect(plan.items).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ profilerAgentId: 'global', scope: 'global' }),
				expect.objectContaining({ profilerAgentId: 'doctor', scope: 'specialist' })
			])
		);
	});

	it('does not run unmatched tagged profilers without a global profiler', () => {
		const plan = buildProfilerPlanForTags(
			[
				createProfiler({
					id: 'finance',
					name: 'Finance',
					priority: 1,
					tagRule: { groups: [{ tags: ['segment:finance'] }] }
				})
			],
			schema,
			['role:doctor'],
			'user-1'
		);

		expect(plan.items).toEqual([]);
		expect(plan.visibleSchema).toEqual([]);
		expect(plan.warnings).toContain('no_applicable_profilers');
	});

	it('uses specialist score then priority for section ownership', () => {
		const profilers = [
			createProfiler({
				id: 'global',
				focusSections: ['medical'],
				priority: 1
			}),
			createProfiler({
				id: 'doctor-general',
				focusSections: ['medical'],
				priority: 1,
				tagRule: { groups: [{ tags: ['role:doctor'] }] }
			}),
			createProfiler({
				id: 'doctor-specialist',
				focusSections: ['medical'],
				priority: 99,
				tagRule: { groups: [{ tags: ['role:doctor', 'specialty:cardiology'] }] }
			})
		];

		const plan = buildProfilerPlanForTags(
			profilers,
			schema,
			['role:doctor', 'specialty:cardiology'],
			'user-1'
		);

		expect(plan.sectionOwners.medical).toBe('doctor-specialist');
	});
});
