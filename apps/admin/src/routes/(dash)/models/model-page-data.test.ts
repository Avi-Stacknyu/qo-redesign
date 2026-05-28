import { describe, expect, test } from 'vitest';

import {
	buildModelEditorData,
	buildModelTableItems,
	modelEditorSelection,
	modelTableSelection
} from './model-page-data';

describe('model-page-data', () => {
	test('table selection excludes oversized model payload columns', () => {
		expect(modelTableSelection).not.toHaveProperty('orRaw');
		expect(modelTableSelection).not.toHaveProperty('optionsSchema');
		expect(modelTableSelection).not.toHaveProperty('defaultOptions');
		expect(modelTableSelection).not.toHaveProperty('capabilities');
		expect(modelTableSelection).not.toHaveProperty('tagRule');
	});

	test('editor selection excludes OpenRouter raw payloads', () => {
		expect(modelEditorSelection).not.toHaveProperty('orRaw');
	});

	test('buildModelTableItems keeps provider labels and tool counts only', () => {
		const items = buildModelTableItems({
			models: [
				{
					id: 'model_1',
					modelId: 'gpt-5.4',
					displayName: 'GPT 5.4',
					description: 'Flagship model',
					isActive: true,
					isSystemDefault: false,
					provider: 'provider_1',
					syncStatus: 'synced'
				}
			],
			providers: [
				{
					id: 'provider_1',
					providerKey: 'openai',
					displayName: 'OpenAI',
					logo: 'openai.svg',
					baseUrl: 'https://api.openai.com'
				}
			],
			toolCounts: [{ modelId: 'model_1', count: 3 }]
		});

		expect(items).toEqual([
			{
				id: 'model_1',
				modelId: 'gpt-5.4',
				displayName: 'GPT 5.4',
				description: 'Flagship model',
				isActive: true,
				isSystemDefault: false,
				provider: 'provider_1',
				syncStatus: 'synced',
				expand: {
					provider: {
						id: 'provider_1',
						providerKey: 'openai',
						displayName: 'OpenAI',
						logo: 'openai.svg'
					},
					supportedToolCount: 3
				}
			}
		]);
	});

	test('buildModelEditorData returns only edit fields plus supported tool ids', () => {
		const editorData = buildModelEditorData(
			{
				id: 'model_1',
				modelId: 'gpt-5.4',
				displayName: 'GPT 5.4',
				description: 'Flagship model',
				isActive: true,
				isEnabled: true,
				provider: 'provider_1',
				optionsSchema: { type: 'object' },
				defaultOptions: { temperature: 0.2 },
				capabilities: { supports_tools: true },
				contextWindow: '128000',
				maxOutputTokens: '8192',
				isSystemDefault: false,
				tagRule: { groups: [] },
				orRaw: { giant: 'payload' },
				currentPricing: 'price_1'
			},
			['tool_1', 'tool_2']
		);

		expect(editorData).toEqual({
			id: 'model_1',
			modelId: 'gpt-5.4',
			displayName: 'GPT 5.4',
			description: 'Flagship model',
			isActive: true,
			isEnabled: true,
			provider: 'provider_1',
			optionsSchema: { type: 'object' },
			defaultOptions: { temperature: 0.2 },
			capabilities: { supports_tools: true },
			contextWindow: '128000',
			maxOutputTokens: '8192',
			isSystemDefault: false,
			tagRule: { groups: [] },
			supportedToolIds: ['tool_1', 'tool_2']
		});
		expect(editorData).not.toHaveProperty('orRaw');
		expect(editorData).not.toHaveProperty('currentPricing');
	});
});
