import { beforeEach, describe, expect, it, vi } from 'vitest';
import { syncModelsToDb, type OrModel } from '../model-sync';
import { createMockDb } from '../../__tests__/setup';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function makeOrModel(overrides: Partial<OrModel> = {}): OrModel {
	return {
		id: 'openai/gpt-5.4-pro',
		name: 'OpenAI: GPT-5.4 Pro',
		created: 1,
		description: 'Test model',
		context_length: 128000,
		supported_parameters: ['temperature'],
		default_parameters: null,
		knowledge_cutoff: null,
		expiration_date: null,
		...overrides,
		architecture: {
			modality: 'text->text',
			input_modalities: ['text'],
			output_modalities: ['text'],
			tokenizer: 'gpt',
			instruct_type: null,
			...overrides.architecture
		},
		pricing: {
			prompt: '0.0000025',
			completion: '0.00001',
			...overrides.pricing
		},
		top_provider: {
			context_length: 128000,
			max_completion_tokens: 8192,
			is_moderated: false,
			...overrides.top_provider
		}
	};
}

describe('syncModelsToDb', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('counts zero-priced OpenRouter models as skipped and does not sync them', async () => {
		const db = createMockDb();
		db.then
			.mockImplementationOnce((resolve: (value: unknown[]) => unknown) => resolve([]))
			.mockImplementationOnce((resolve: (value: unknown[]) => unknown) =>
				resolve([{ id: 'prov-openai', providerKey: 'openai', isActive: true }])
			)
			.mockImplementationOnce((resolve: (value: unknown[]) => unknown) => resolve([]));

		fetchMock.mockResolvedValue({
			ok: true,
			json: async () => ({
				data: [
					makeOrModel({
						pricing: {
							prompt: '0',
							completion: '0'
						}
					})
				]
			})
		});

		const result = await syncModelsToDb(db as any);

		expect(result).toMatchObject({
			created: 0,
			updated: 0,
			deprecated: 0,
			pricingUpdated: 0,
			skipped: 1,
			errors: []
		});
		expect(db.insert).not.toHaveBeenCalled();
		expect(db.update).not.toHaveBeenCalled();
	});
});
