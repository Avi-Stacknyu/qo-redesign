import { describe, expect, it } from 'vitest';

import type { ProfileSection } from '$lib/data/profile-types';
import {
	buildDiscoveryPrompt,
	buildOnboardingSections,
	sendDiscoveryPrompt
} from './discover-tab';

const makeSection = (overrides: Partial<ProfileSection> = {}): ProfileSection => ({
	sectionId: 'basics',
	label: 'Basics',
	icon: 'user',
	order: 1,
	fields: [
		{
			key: 'preferredName',
			value: '',
			label: 'Preferred Name',
			confidence: 0,
			source: 'onboarding',
			isSchema: true,
			updatedAt: '2026-05-28T00:00:00.000Z'
		},
		{
			key: 'timezone',
			value: 'EST',
			label: 'Timezone',
			confidence: 1,
			source: 'chat',
			isSchema: true,
			updatedAt: '2026-05-28T00:00:00.000Z'
		},
		{
			key: 'note',
			value: '',
			label: 'Internal Note',
			confidence: 0,
			source: 'user_edit',
			isSchema: false,
			updatedAt: '2026-05-28T00:00:00.000Z'
		}
	],
	completionPct: 50,
	schemaFieldCount: 2,
	filledSchemaCount: 1,
	...overrides
});

describe('buildOnboardingSections', () => {
	it('sorts sections and assigns accents from completion percentage', () => {
		const result = buildOnboardingSections([
			makeSection({ sectionId: 'advanced', label: 'Advanced', order: 3, completionPct: 100 }),
			makeSection({ sectionId: 'communication', label: 'Communication', order: 2, completionPct: 15 }),
			makeSection({ sectionId: 'basics', label: 'Basics', order: 1, completionPct: 50 })
		]);

		expect(result.map((section) => section.sectionId)).toEqual(['basics', 'communication', 'advanced']);
		expect(result.map((section) => section.accent)).toEqual(['violet', 'slate', 'emerald']);
	});
});

describe('buildDiscoveryPrompt', () => {
	it('references known fields when a section is partially complete', () => {
		const prompt = buildDiscoveryPrompt(makeSection());

		expect(prompt).toBe(
			'Help me fill in my basics section. You already know my timezone. I have 1 fields left.'
		);
	});

	it('switches to review language when all schema fields are filled', () => {
		const prompt = buildDiscoveryPrompt(
			makeSection({
				fields: [
					{
						key: 'preferredName',
						value: 'Alex',
						label: 'Preferred Name',
						confidence: 1,
						source: 'chat',
						isSchema: true,
						updatedAt: '2026-05-28T00:00:00.000Z'
					}
				],
				completionPct: 100,
				schemaFieldCount: 1,
				filledSchemaCount: 1
			})
		);

		expect(prompt).toBe(
			"Let's review my basics information - is everything still accurate?"
		);
	});
});

describe('sendDiscoveryPrompt', () => {
	it('sends through the ensured chat instance when no current chat exists yet', async () => {
		const sentTexts: string[] = [];

		await sendDiscoveryPrompt({
			text: 'Help me fill in basics',
			currentChat: null,
			ensureChat: async () => ({
				sendMessage: async ({ text }) => {
					sentTexts.push(text);
				}
			})
		});

		expect(sentTexts).toEqual(['Help me fill in basics']);
	});
});