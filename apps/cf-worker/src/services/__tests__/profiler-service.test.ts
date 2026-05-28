/**
 * ProfilerService Tests
 *
 * Tests for ProfilerService.updateProfile(), serializeProfileForPrompt(),
 * and related profiler logic. LLM calls are mocked — we verify prompt construction,
 * result parsing, graph write calls, and cost tracking.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	ProfilerService,
	clearProfilerCache,
	type ProfilerContext
} from '../../services/profiler-service';
import type { MessagePair } from '../../services/session-summarizer';
import type { ProfileSchemaSection, ProfileSectionData } from '../../types/profiler';
import type { GraphNode } from '../../types';
import { createMockDb, createMockEnv } from '../../__tests__/setup';
import { clearGlobalSchemaCache } from '../../utils/schema-loader';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('ai', () => ({
	generateText: vi.fn(),
	Output: {
		object: vi.fn((config) => ({ type: 'object-output', ...config }))
	}
}));

vi.mock('../../utils/model-factory', () => ({
	getModel: vi.fn().mockReturnValue('mock-model-instance'),
	getModelConfigWithFallback: vi.fn().mockResolvedValue({
		config_key: 'profiler_extraction_fallback_model',
		model_id: 'gpt-4o-mini',
		providerConfig: { provider_key: 'openai' }
	}),
	getModelFromConfig: vi.fn().mockReturnValue('mock-fallback-model-instance')
}));

vi.mock('../../utils/billing', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../utils/billing')>();
	return {
		...actual,
		computeInferenceCost: vi.fn().mockReturnValue({
			costUsd: 0.001,
			tokens: { input: 200, output: 50 }
		}),
		getCreditsPerUsd: vi.fn().mockResolvedValue(100)
	};
});

vi.mock('../../utils/schema-loader', () => ({
	loadGlobalProfileSchema: vi.fn(),
	clearGlobalSchemaCache: vi.fn()
}));

// Mock MemoryGraphService — the constructor returns a controllable stub
let mockGraphInstance: ReturnType<typeof createGraphStub>;
vi.mock('../../graph/memory-graph-service', () => ({
	MemoryGraphService: class MockMemoryGraphService {
		constructor() {
			return mockGraphInstance as any;
		}
	}
}));

const { generateText } = await import('ai');
const { getModel, getModelConfigWithFallback, getModelFromConfig } =
	await import('../../utils/model-factory');
const { loadGlobalProfileSchema } = await import('../../utils/schema-loader');

// ============================================================================
// Test Data
// ============================================================================

const MOCK_SCHEMA: ProfileSchemaSection[] = [
	{
		section_id: 'personal',
		label: 'Personal Information',
		icon: 'user',
		order: 1,
		fields: [
			{ key: 'name', label: 'Name', type: 'text' },
			{ key: 'age', label: 'Age', type: 'number' }
		]
	},
	{
		section_id: 'financial',
		label: 'Financial Information',
		icon: 'dollar-sign',
		order: 2,
		fields: [
			{ key: 'annual_income', label: 'Annual Income', type: 'number' },
			{ key: 'risk_tolerance', label: 'Risk Tolerance', type: 'text' }
		]
	}
];

// Drizzle relational row shape matching getProfilerAgent() query
const MOCK_PROFILER_AGENT_ROW = {
	id: 'profiler-1',
	name: 'Finance Profiler',
	status: 'active' as const,
	systemPrompt: 'You are a financial profiler.',
	maxTokens: '500',
	model: 'model-1',
	focusSections: null,
	aiAgentModel: {
		id: 'model-1',
		modelId: 'claude-3-5-sonnet',
		currentPricing: 'rate-1',
		aiProvider: {
			providerKey: 'anthropic'
		},
		aiPricingRate: {
			id: 'rate-1',
			inputPricePer1M: '0.25',
			outputPricePer1M: '1.25',
			cachedInputPricePer1M: null,
			reasoningPricePer1M: null,
			pricePerCall: null,
			pricePerCharacter: null,
			pricePerImage: null,
			pricePerMinute: null,
			pricePerSecond: null,
			effectiveFrom: null,
			effectiveUntil: null,
			isActive: true,
			notes: null,
			tier: null
		}
	}
};

function setProfilerAgentRow(
	ctx: ProfilerContext & { _db: ReturnType<typeof createMockDb> },
	row: unknown = MOCK_PROFILER_AGENT_ROW
) {
	ctx._db.query.profilerAgents.findFirst.mockResolvedValue(row);
}

const MOCK_MESSAGES: MessagePair[] = [
	{
		userMessage: "I'm 30 years old and I earn about $120k per year.",
		assistantResponse: "That's great! Let me help you plan your finances."
	}
];

const MOCK_CHAIN_ROW = {
	id: 'chain-1',
	profilerAgentId: 'profiler-1',
	modelId: 'model-1',
	priority: 0,
	temperature: '0.2',
	maxTokens: 500,
	timeoutMs: 30000,
	retryCount: 1,
	isActive: true,
	aiAgentModel: MOCK_PROFILER_AGENT_ROW.aiAgentModel
};

function createGraphStub(profileNodes: GraphNode[] = []) {
	return {
		getProfile: vi.fn().mockReturnValue(profileNodes),
		applyProfileUpdates: vi.fn(),
		upsertNode: vi.fn().mockResolvedValue(undefined),
		connectNodes: vi.fn().mockResolvedValue(undefined),
		getNode: vi.fn().mockResolvedValue(null)
	};
}

function createProfilerCtx(
	overrides: Partial<ProfilerContext> = {}
): ProfilerContext & { _db: ReturnType<typeof createMockDb> } {
	const db = createMockDb();
	const env = createMockEnv();

	// Mock schema-loader to return MOCK_SCHEMA (module-level mock, configured here)
	(loadGlobalProfileSchema as any).mockResolvedValue(MOCK_SCHEMA);

	// Set the graph instance returned by MemoryGraphService constructor
	mockGraphInstance = createGraphStub();

	const ctx: ProfilerContext = {
		env: env as any,
		db: db as any,
		userId: 'user-1',
		sessionId: 'session-1',
		agentId: 'agent-1',
		profilerAgentId: 'profiler-1',
		...overrides
	};

	return { ...ctx, _db: db };
}

// ============================================================================
// Tests
// ============================================================================

describe('ProfilerService', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		clearProfilerCache();
		clearGlobalSchemaCache();
	});

	// ========================================================================
	// updateProfile — happy path
	// ========================================================================

	describe('updateProfile', () => {
		it('skips when messages array is empty', async () => {
			const ctx = createProfilerCtx();
			const service = new ProfilerService(ctx);

			await service.updateProfile([]);

			expect(ctx._db.query.profilerAgents.findFirst).not.toHaveBeenCalled();
			expect(generateText).not.toHaveBeenCalled();
		});

		it('skips when profiler agent status is inactive', async () => {
			const ctx = createProfilerCtx();
			setProfilerAgentRow(ctx, { ...MOCK_PROFILER_AGENT_ROW, status: 'inactive' });

			const service = new ProfilerService(ctx);
			await service.updateProfile(MOCK_MESSAGES);

			expect(generateText).not.toHaveBeenCalled();
		});

		it('calls generateText with constructed prompt', async () => {
			const ctx = createProfilerCtx();
			setProfilerAgentRow(ctx);

			(generateText as any).mockResolvedValue({
				text: '{ "updates": [] }',
				usage: { promptTokens: 200, completionTokens: 50 }
			});

			const service = new ProfilerService(ctx);
			await service.updateProfile(MOCK_MESSAGES);

			expect(generateText).toHaveBeenCalledWith(
				expect.objectContaining({
					model: 'mock-model-instance',
					maxOutputTokens: 500
				})
			);

			// Verify prompt includes system prompt + conversation
			const call = (generateText as any).mock.calls[0][0];
			expect(call.prompt).toContain('You are a financial profiler.');
			expect(call.prompt).toContain("I'm 30 years old");
			expect(call.prompt).toContain('PROFILE SCHEMA');
		});

		it('resolves model via getModel with correct provider', async () => {
			const ctx = createProfilerCtx();
			setProfilerAgentRow(ctx);

			(generateText as any).mockResolvedValue({
				text: '{ "updates": [] }',
				usage: { promptTokens: 100, completionTokens: 20 }
			});

			const service = new ProfilerService(ctx);
			await service.updateProfile(MOCK_MESSAGES);

			expect(getModel).toHaveBeenCalledWith('anthropic', 'claude-3-5-sonnet', ctx.env);
		});

		it('uses the configured profiler fallback model when the primary provider fails', async () => {
			const ctx = createProfilerCtx();
			setProfilerAgentRow(ctx);

			(generateText as any)
				.mockRejectedValueOnce(new Error('provider down'))
				.mockResolvedValueOnce({
					text: '{ "updates": [] }',
					usage: { promptTokens: 100, completionTokens: 20 }
				});

			const service = new ProfilerService(ctx);
			await service.updateProfile(MOCK_MESSAGES);

			expect(getModelConfigWithFallback).toHaveBeenCalledWith(
				ctx.db,
				'profiler_extraction_fallback_model'
			);
			expect(getModelFromConfig).toHaveBeenCalledWith(
				expect.objectContaining({ model_id: 'gpt-4o-mini' }),
				ctx.env
			);
			expect(generateText).toHaveBeenNthCalledWith(
				2,
				expect.objectContaining({ model: 'mock-fallback-model-instance' })
			);
		});

		it('skips when profiler agent has no model expanded', async () => {
			const ctx = createProfilerCtx();
			setProfilerAgentRow(ctx, {
				...MOCK_PROFILER_AGENT_ROW,
				aiAgentModel: null
			});

			const service = new ProfilerService(ctx);
			await service.updateProfile(MOCK_MESSAGES);

			expect(generateText).not.toHaveBeenCalled();
		});

		it('applies profile updates to graph when LLM returns fields', async () => {
			const graphStub = createGraphStub();
			const ctx = createProfilerCtx();
			mockGraphInstance = graphStub;

			setProfilerAgentRow(ctx);

			const llmResult = {
				updates: [
					{
						section: 'personal',
						fields: {
							age: { value: '30' },
							name: { value: 'Meet' }
						}
					}
				]
			};

			(generateText as any).mockResolvedValue({
				text: JSON.stringify(llmResult),
				usage: { promptTokens: 200, completionTokens: 50 }
			});

			const service = new ProfilerService(ctx);
			await service.updateProfile(MOCK_MESSAGES);

			expect(graphStub.applyProfileUpdates).toHaveBeenCalledWith(
				'user-1',
				llmResult.updates,
				'chat',
				MOCK_SCHEMA,
				expect.objectContaining({
					personal: { label: 'Personal Information', icon: 'user', order: 1 },
					financial: { label: 'Financial Information', icon: 'dollar-sign', order: 2 }
				})
			);
		});

		it('treats owned sections as prompt scaffolding instead of a write boundary', async () => {
			const graphStub = createGraphStub();
			const ctx = createProfilerCtx();
			mockGraphInstance = graphStub;

			setProfilerAgentRow(ctx);

			const seededSchema = MOCK_SCHEMA.filter((section) => section.section_id === 'financial');
			const llmResult = {
				updates: [
					{
						section: 'personal',
						fields: {
							name: { value: 'Meet' }
						}
					},
					{
						section: 'life_context',
						fields: {
							family_structure: { value: 'married', label: 'Family Structure' }
						}
					}
				]
			};

			(generateText as any).mockResolvedValue({
				text: JSON.stringify(llmResult),
				usage: { promptTokens: 200, completionTokens: 50 }
			});

			const service = new ProfilerService(ctx);
			await service.updateProfile(MOCK_MESSAGES, {
				schema: seededSchema,
				ownedSectionIds: ['financial']
			});

			expect(graphStub.applyProfileUpdates).toHaveBeenCalledWith(
				'user-1',
				llmResult.updates,
				'chat',
				seededSchema,
				expect.objectContaining({
					financial: { label: 'Financial Information', icon: 'dollar-sign', order: 2 }
				})
			);
		});

		it('keeps broader profile context visible even when schema guidance is seeded to owned sections', async () => {
			const graphStub = createGraphStub([
				{
					id: 'profile::user-1::personal',
					type: 'PROFILE_SECTION',
					data: {
						label: 'Personal Information',
						icon: 'user',
						order: 1,
						fields: {
							name: {
								value: 'Meet',
								label: 'Name',
								confidence: 1,
								source: 'chat',
								isSchema: true,
								updatedAt: '2026-01-01T00:00:00Z'
							}
						}
					},
					confidence: 1,
					decayScore: 1,
					createdAt: '2026-01-01T00:00:00Z',
					updatedAt: '2026-01-01T00:00:00Z'
				}
			]);
			const ctx = createProfilerCtx();
			mockGraphInstance = graphStub;

			setProfilerAgentRow(ctx);

			(generateText as any).mockResolvedValue({
				text: '{ "updates": [] }',
				usage: { promptTokens: 100, completionTokens: 20 }
			});

			const service = new ProfilerService(ctx);
			await service.updateProfile(MOCK_MESSAGES, {
				schema: MOCK_SCHEMA.filter((section) => section.section_id === 'financial'),
				ownedSectionIds: ['financial']
			});

			const call = (generateText as any).mock.calls[0][0];
			expect(call.prompt).toContain('Section: personal');
			expect(call.prompt).toContain('name = "Meet"');
		});

		it('skips graph write when LLM returns empty updates', async () => {
			const graphStub = createGraphStub();
			const ctx = createProfilerCtx();
			mockGraphInstance = graphStub;

			setProfilerAgentRow(ctx);

			(generateText as any).mockResolvedValue({
				text: '{ "updates": [] }',
				usage: { promptTokens: 200, completionTokens: 10 }
			});

			const service = new ProfilerService(ctx);
			await service.updateProfile(MOCK_MESSAGES);

			expect(graphStub.applyProfileUpdates).not.toHaveBeenCalled();
		});

		it('handles malformed JSON from LLM gracefully', async () => {
			const ctx = createProfilerCtx();
			setProfilerAgentRow(ctx);

			(generateText as any).mockResolvedValue({
				text: 'Not valid JSON at all',
				usage: { promptTokens: 200, completionTokens: 10 }
			});

			const service = new ProfilerService(ctx);
			// Should not throw
			await expect(service.updateProfile(MOCK_MESSAGES)).resolves.toBeUndefined();
		});

		it('extracts JSON from markdown-wrapped response', async () => {
			const graphStub = createGraphStub();
			const ctx = createProfilerCtx();
			mockGraphInstance = graphStub;

			setProfilerAgentRow(ctx);

			const llmResult = {
				updates: [{ section: 'personal', fields: { name: { value: 'Meet' } } }]
			};

			(generateText as any).mockResolvedValue({
				text: `Here is the result:\n\`\`\`json\n${JSON.stringify(llmResult)}\n\`\`\``,
				usage: { promptTokens: 200, completionTokens: 30 }
			});

			const service = new ProfilerService(ctx);
			await service.updateProfile(MOCK_MESSAGES);

			expect(graphStub.applyProfileUpdates).toHaveBeenCalledWith(
				'user-1',
				llmResult.updates,
				'chat',
				expect.any(Array),
				expect.any(Object)
			);
		});

		it('caches profiler agent across calls', async () => {
			const ctx = createProfilerCtx();
			setProfilerAgentRow(ctx);

			(generateText as any).mockResolvedValue({
				text: '{ "updates": [] }',
				usage: { promptTokens: 100, completionTokens: 10 }
			});

			const service = new ProfilerService(ctx);
			await service.updateProfile(MOCK_MESSAGES);
			await service.updateProfile(MOCK_MESSAGES);

			// Profiler record should only be loaded once (cached)
			expect(ctx._db.query.profilerAgents.findFirst).toHaveBeenCalledTimes(1);
		});
	});

	// ========================================================================
	// Cost tracking
	// ========================================================================

	describe('cost tracking', () => {
		it('tracks cost when costTracker provided', async () => {
			const costTracker = {
				addEvent: vi.fn(),
				getSummary: vi.fn()
			};
			const ctx = createProfilerCtx({ costTracker: costTracker as any });
			setProfilerAgentRow(ctx);

			(generateText as any).mockResolvedValue({
				text: '{ "updates": [] }',
				usage: { promptTokens: 200, completionTokens: 50 }
			});

			const service = new ProfilerService(ctx);
			await service.updateProfile(MOCK_MESSAGES);

			expect(costTracker.addEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					operation: 'inference',
					modelId: 'claude-3-5-sonnet',
					metadata: { purpose: 'profiler_extraction' }
				})
			);
		});

		it('skips cost tracking when no costTracker', async () => {
			const ctx = createProfilerCtx();
			setProfilerAgentRow(ctx);

			(generateText as any).mockResolvedValue({
				text: '{ "updates": [] }',
				usage: { promptTokens: 200, completionTokens: 50 }
			});

			const service = new ProfilerService(ctx);
			// Should not throw
			await expect(service.updateProfile(MOCK_MESSAGES)).resolves.toBeUndefined();
		});
	});

	// ========================================================================
	// extractStructured
	// ========================================================================

	describe('extractStructured', () => {
		it('writes schema fields and discovered fields into profile sections', async () => {
			const ctx = createProfilerCtx();
			(ctx._db.query as any).profilerModelChain = {
				findMany: vi.fn().mockResolvedValue([MOCK_CHAIN_ROW])
			};

			(generateText as any).mockResolvedValue({
				output: {
					profileUpdates: [
						{
							sectionId: 'personal',
							fields: {
								age: { value: 30, confidence: 0.92, reasoning: 'User said they are 30.' },
								family_status: {
									value: 'single',
									confidence: 0.9,
									reasoning: 'Not actually stated.'
								}
							}
						}
					],
					memoryObservations: [],
					schemaProposals: []
				},
				usage: { inputTokens: 100, outputTokens: 20 }
			});

			const service = new ProfilerService(ctx);
			const ran = await service.extractStructured(
				MOCK_MESSAGES,
				[
					{
						sectionId: 'personal',
						fields: MOCK_SCHEMA[0].fields.map((field) => ({
							key: field.key,
							label: field.label,
							type: field.type === 'number' ? ('number' as const) : ('string' as const)
						}))
					}
				],
				{ source: 'chat', fullSchema: [MOCK_SCHEMA[0]] }
			);

			expect(ran).toBe(true);
			expect(getModel).toHaveBeenCalledWith('anthropic', 'claude-3-5-sonnet', ctx.env);
			expect(mockGraphInstance.upsertNode).toHaveBeenCalledWith(
				expect.objectContaining({
					id: 'profile::user-1::personal',
					type: 'PROFILE_SECTION',
					data: expect.objectContaining({
						fields: expect.objectContaining({
							age: expect.objectContaining({ value: 30, confidence: 0.92, isSchema: true }),
							family_status: expect.objectContaining({
								value: 'single',
								confidence: 0.9,
								isSchema: false
							})
						})
					})
				})
			);

			const ledgerRow = ctx._db.values.mock.calls[0][0];
			expect(ledgerRow.profileFieldsWritten).toHaveLength(2);
			expect(ledgerRow.profileFieldsSkipped).toEqual([]);
			expect(ledgerRow.modelUsed).toBe('claude-3-5-sonnet');
			expect(ledgerRow.providerUsed).toBe('anthropic');
		});

		it('writes discovered sections into profile nodes', async () => {
			const ctx = createProfilerCtx();
			(ctx._db.query as any).profilerModelChain = {
				findMany: vi.fn().mockResolvedValue([MOCK_CHAIN_ROW])
			};

			(generateText as any).mockResolvedValue({
				output: {
					profileUpdates: [
						{
							sectionId: 'liquidity_events',
							sectionLabel: 'Liquidity Events',
							fields: {
								expected_exit_timeline: {
									value: '12-18 months',
									label: 'Expected Exit Timeline',
									confidence: 0.86,
									reasoning: 'User stated the expected company sale timeline.'
								}
							}
						}
					],
					memoryObservations: [],
					schemaProposals: []
				},
				usage: { inputTokens: 100, outputTokens: 20 }
			});

			const service = new ProfilerService(ctx);
			const ran = await service.extractStructured(MOCK_MESSAGES, [], {
				source: 'onboarding',
				fullSchema: []
			});

			expect(ran).toBe(true);
			expect(mockGraphInstance.upsertNode).toHaveBeenCalledWith(
				expect.objectContaining({
					id: 'profile::user-1::liquidity_events',
					type: 'PROFILE_SECTION',
					data: expect.objectContaining({
						label: 'Liquidity Events',
						fields: expect.objectContaining({
							expected_exit_timeline: expect.objectContaining({
								value: '12-18 months',
								label: 'Expected Exit Timeline',
								isSchema: false
							})
						})
					})
				})
			);
		});

		it('mirrors memory observations into profile sections', async () => {
			const ctx = createProfilerCtx();
			(ctx._db.query as any).profilerModelChain = {
				findMany: vi.fn().mockResolvedValue([MOCK_CHAIN_ROW])
			};

			(generateText as any).mockResolvedValue({
				output: {
					profileUpdates: [],
					memoryObservations: [
						{
							nodeType: 'FACT',
							text: 'The user earns about $120k per year.',
							category: 'financial',
							data: {},
							confidence: 0.8,
							visibility: {
								shareWithAgent: true,
								shareWithManager: false,
								shareWithAdmin: false
							}
						}
					],
					schemaProposals: []
				},
				usage: { inputTokens: 100, outputTokens: 20 }
			});

			const service = new ProfilerService(ctx);
			const ran = await service.extractStructured(
				MOCK_MESSAGES,
				[
					{
						sectionId: 'financial',
						fields: MOCK_SCHEMA[1].fields.map((field) => ({
							key: field.key,
							label: field.label,
							type: field.type === 'number' ? ('number' as const) : ('string' as const)
						}))
					}
				],
				{ source: 'chat', fullSchema: [MOCK_SCHEMA[1]] }
			);

			expect(ran).toBe(true);
			const profileCall = mockGraphInstance.upsertNode.mock.calls.find(
				([node]) => node.type === 'PROFILE_SECTION'
			)?.[0];
			expect(profileCall).toEqual(
				expect.objectContaining({ id: 'profile::user-1::financial', type: 'PROFILE_SECTION' })
			);
			expect(Object.values(profileCall.data.fields)).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						value: 'The user earns about $120k per year.',
						isSchema: false,
						source: 'chat'
					})
				])
			);

			const ledgerRow = ctx._db.values.mock.calls[0][0];
			expect(ledgerRow.profileFieldsWritten).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						sectionId: 'financial'
					})
				])
			);
		});
	});

	// ========================================================================
	// serializeProfileForPrompt
	// ========================================================================

	describe('serializeProfileForPrompt', () => {
		it('returns empty message when no nodes and no schema', () => {
			const ctx = createProfilerCtx();
			const service = new ProfilerService(ctx);

			const result = service.serializeProfileForPrompt([], []);
			expect(result).toBe('Current profile: (empty — no information collected yet)');
		});

		it('shows schema fields with null placeholder for missing values', () => {
			const ctx = createProfilerCtx();
			const service = new ProfilerService(ctx);

			const result = service.serializeProfileForPrompt([], MOCK_SCHEMA);

			expect(result).toContain('Section: personal (schema fields)');
			expect(result).toContain('name = null ← not yet collected');
			expect(result).toContain('age = null ← not yet collected');
			expect(result).toContain('Section: financial (schema fields)');
			expect(result).toContain('annual_income = null ← not yet collected');
		});

		it('shows filled schema fields with their values', () => {
			const ctx = createProfilerCtx();
			const service = new ProfilerService(ctx);

			const nodes: GraphNode[] = [
				{
					id: 'profile::personal',
					type: 'PROFILE_SECTION',
					data: {
						label: 'Personal Information',
						icon: 'user',
						order: 1,
						fields: {
							name: {
								value: 'Meet',
								label: 'Name',
								confidence: 0.8,
								source: 'chat',
								isSchema: true,
								updatedAt: '2026-01-01T00:00:00Z'
							}
						}
					},
					confidence: 1.0,
					decayScore: 1.0,
					createdAt: '2026-01-01',
					updatedAt: '2026-01-01'
				}
			];

			const result = service.serializeProfileForPrompt(nodes, MOCK_SCHEMA);

			expect(result).toContain('name = "Meet"');
			expect(result).toContain('age = null ← not yet collected');
		});

		it('separates schema and discovered fields', () => {
			const ctx = createProfilerCtx();
			const service = new ProfilerService(ctx);

			const nodes: GraphNode[] = [
				{
					id: 'profile::personal',
					type: 'PROFILE_SECTION',
					data: {
						label: 'Personal Information',
						icon: 'user',
						order: 1,
						fields: {
							name: {
								value: 'Meet',
								label: 'Name',
								confidence: 0.8,
								source: 'chat',
								isSchema: true,
								updatedAt: '2026-01-01T00:00:00Z'
							},
							hobbies: {
								value: 'hiking',
								label: 'Hobbies',
								confidence: 0.7,
								source: 'chat',
								isSchema: false,
								updatedAt: '2026-01-01T00:00:00Z'
							}
						}
					},
					confidence: 1.0,
					decayScore: 1.0,
					createdAt: '2026-01-01',
					updatedAt: '2026-01-01'
				}
			];

			const result = service.serializeProfileForPrompt(nodes, MOCK_SCHEMA);

			expect(result).toContain('Section: personal (schema fields)');
			expect(result).toContain('Section: personal (discovered)');
			expect(result).toContain('hobbies = "hiking"');
		});

		it('renders sections not in schema as fully discovered', () => {
			const ctx = createProfilerCtx();
			const service = new ProfilerService(ctx);

			const nodes: GraphNode[] = [
				{
					id: 'profile::lifestyle',
					type: 'PROFILE_SECTION',
					data: {
						label: 'Lifestyle',
						icon: 'heart',
						order: 5,
						fields: {
							exercise: {
								value: '3x/week',
								label: 'Exercise Frequency',
								confidence: 0.7,
								source: 'chat',
								isSchema: false,
								updatedAt: '2026-01-01T00:00:00Z'
							}
						}
					},
					confidence: 1.0,
					decayScore: 1.0,
					createdAt: '2026-01-01',
					updatedAt: '2026-01-01'
				}
			];

			// Empty schema — lifestyle section is fully discovered
			const result = service.serializeProfileForPrompt(nodes, []);

			expect(result).toContain('Section: lifestyle (discovered)');
			expect(result).toContain('exercise = "3x/week"');
		});
	});
});
