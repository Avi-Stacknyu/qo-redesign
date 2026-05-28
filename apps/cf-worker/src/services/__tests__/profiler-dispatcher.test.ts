import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockDb, createMockEnv } from '../../__tests__/setup';
import { ProfilerDispatcher } from '../../services/profiler-dispatcher';
import type { MessagePair } from '../../services/session-summarizer';
import type { ProfileSchemaSection } from '../../types/profiler';

const mocks = vi.hoisted(() => ({
	createProfilerService: vi.fn(),
	updateProfile: vi.fn(),
	extractStructured: vi.fn(),
	loadActiveProfilers: vi.fn(),
	buildProfilerPlanForTags: vi.fn(),
	loadGlobalProfileSchema: vi.fn()
}));

vi.mock('../../services/profiler-service', () => ({
	createProfilerService: mocks.createProfilerService
}));

vi.mock('../../services/profiler-routing', () => ({
	loadActiveProfilers: mocks.loadActiveProfilers,
	buildProfilerPlanForTags: mocks.buildProfilerPlanForTags
}));

vi.mock('../../utils/schema-loader', () => ({
	loadGlobalProfileSchema: mocks.loadGlobalProfileSchema
}));

const MOCK_MESSAGES: MessagePair[] = [
	{
		userMessage: 'I earn about $120k and want help with portfolio planning.',
		assistantResponse: 'Got it, I can help profile that.'
	}
];

const MOCK_SCHEMA: ProfileSchemaSection[] = [
	{
		section_id: 'financial',
		label: 'Financial Information',
		icon: 'dollar-sign',
		order: 1,
		fields: [{ key: 'annual_income', label: 'Annual Income', type: 'number' }]
	}
];

function createDispatcher(source?: 'chat' | 'onboarding') {
	return new ProfilerDispatcher({
		env: createMockEnv() as never,
		db: createMockDb() as never,
		userId: 'user-1',
		sessionId: 'session-1',
		agentId: 'agent-1',
		userTags: [],
		...(source ? { source } : {})
	});
}

describe('ProfilerDispatcher', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.loadActiveProfilers.mockResolvedValue([
			{ id: 'profiler-1', name: 'Default Profiler', tagRule: null, focusSections: [] }
		]);
		mocks.loadGlobalProfileSchema.mockResolvedValue(MOCK_SCHEMA);
		mocks.buildProfilerPlanForTags.mockReturnValue({
			userId: 'user-1',
			userTags: [],
			items: [
				{
					profilerAgentId: 'profiler-1',
					name: 'Default Profiler',
					scope: 'global',
					score: 0,
					priority: 50,
					focusSections: [],
					ownedSections: ['financial']
				}
			],
			sectionOwners: { financial: 'profiler-1' },
			visibleSchema: MOCK_SCHEMA,
			warnings: []
		});
		mocks.updateProfile.mockResolvedValue(undefined);
		mocks.extractStructured.mockResolvedValue(true);
		mocks.createProfilerService.mockReturnValue({
			updateProfile: mocks.updateProfile,
			extractStructured: mocks.extractStructured
		});
	});

	it('uses structured extraction for discovery chat extraction', async () => {
		const dispatcher = createDispatcher();

		await dispatcher.dispatch(MOCK_MESSAGES);

		expect(mocks.extractStructured).toHaveBeenCalledWith(
			MOCK_MESSAGES,
			[
				{
					sectionId: 'financial',
					fields: [{ key: 'annual_income', label: 'Annual Income', type: 'number' }]
				}
			],
			{
				source: 'chat',
				fullSchema: MOCK_SCHEMA
			}
		);
		expect(mocks.updateProfile).not.toHaveBeenCalled();
	});

	it('falls back to the legacy profile updater for chat when structured extraction declines', async () => {
		mocks.extractStructured.mockResolvedValue(false);
		const dispatcher = createDispatcher();

		await dispatcher.dispatch(MOCK_MESSAGES);

		expect(mocks.updateProfile).toHaveBeenCalledWith(MOCK_MESSAGES, {
			source: 'chat',
			schema: MOCK_SCHEMA,
			ownedSectionIds: ['financial']
		});
	});

	it('keeps structured extraction available for onboarding and falls back when needed', async () => {
		mocks.extractStructured.mockResolvedValue(false);
		const dispatcher = createDispatcher('onboarding');

		await dispatcher.dispatch(MOCK_MESSAGES);

		expect(mocks.extractStructured).toHaveBeenCalled();
		expect(mocks.updateProfile).toHaveBeenCalledWith(MOCK_MESSAGES, {
			source: 'onboarding',
			schema: MOCK_SCHEMA,
			ownedSectionIds: ['financial']
		});
	});
});
