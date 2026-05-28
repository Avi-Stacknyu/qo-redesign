import { describe, expect, it } from 'vitest';
import { getPinnedModelInfo } from '@repo/shared/utils';
import type { CompiledFlowConfig, FlowData } from '@repo/shared/types';

describe('getPinnedModelInfo', () => {
	it('returns a single-model lock hint when execution nodes share one pinned model', () => {
		const compiledConfig = {
			nodes: {
				start: { id: 'start', type: 'start', label: 'Start', config: {}, next: ['llm-1'] },
				'llm-1': {
					id: 'llm-1',
					type: 'llm',
					label: 'Answer',
					config: { model_id: 'model-1' },
					next: []
				},
				'classifier-1': {
					id: 'classifier-1',
					type: 'classifier',
					label: 'Route',
					config: { model_id: 'model-1' },
					next: []
				}
			},
			resolved: {
				models: {
					'model-1': {
						id: 'model-1',
						model_id: 'claude-sonnet',
						display_name: 'Claude Sonnet',
						provider_id: 'provider-1',
						provider_key: 'anthropic'
					}
				},
				tools: {}
			},
			version: '2.0',
			start_node_id: 'start',
			global_config: { knowledge_base: [], default_timeout_ms: 30000 },
			metadata: {
				total_nodes: 3,
				has_classifier: true,
				has_implicit_parallel: false,
				max_depth: 2,
				node_type_counts: { start: 1, end: 0, llm: 1, classifier: 1 }
			}
		} satisfies CompiledFlowConfig;

		const info = getPinnedModelInfo(compiledConfig, null);

		expect(info).toEqual({
			modelIds: ['model-1'],
			modelNames: ['Claude Sonnet'],
			label: 'Best with Claude Sonnet',
			message:
				'This agent is configured to work best with Claude Sonnet, so model switching is unavailable for this chat.'
		});
	});

	it('falls back to flow_data when compiled config is missing', () => {
		const flowData = {
			nodes: [
				{ id: 'start', type: 'start', data: { label: 'Start' }, position: { x: 0, y: 0 } },
				{
					id: 'llm-1',
					type: 'llm',
					data: { label: 'Answer', model_id: 'model-2', tools: [] },
					position: { x: 10, y: 10 }
				}
			],
			edges: []
		} satisfies FlowData;

		const info = getPinnedModelInfo(null, flowData);

		expect(info).toEqual({
			modelIds: ['model-2'],
			modelNames: [],
			label: 'Pinned workflow',
			message:
				'This agent uses pinned models in its workflow, so model switching is unavailable for this chat.'
		});
	});

	it('returns a generic workflow hint for multiple pinned models', () => {
		const compiledConfig = {
			nodes: {
				'llm-1': {
					id: 'llm-1',
					type: 'llm',
					label: 'Answer',
					config: { model_id: 'model-1' },
					next: []
				},
				'classifier-1': {
					id: 'classifier-1',
					type: 'classifier',
					label: 'Route',
					config: { model_id: 'model-2' },
					next: []
				},
				end: { id: 'end', type: 'end', label: 'Done', config: {}, next: [] }
			},
			resolved: {
				models: {
					'model-1': {
						id: 'model-1',
						model_id: 'gpt-4.1',
						display_name: 'GPT-4.1',
						provider_id: 'provider-1',
						provider_key: 'openai'
					},
					'model-2': {
						id: 'model-2',
						model_id: 'claude-sonnet',
						display_name: 'Claude Sonnet',
						provider_id: 'provider-2',
						provider_key: 'anthropic'
					}
				},
				tools: {}
			},
			version: '2.0',
			start_node_id: 'llm-1',
			global_config: { knowledge_base: [], default_timeout_ms: 30000 },
			metadata: {
				total_nodes: 3,
				has_classifier: true,
				has_implicit_parallel: false,
				max_depth: 2,
				node_type_counts: { start: 0, end: 1, llm: 1, classifier: 1 }
			}
		} satisfies CompiledFlowConfig;

		const info = getPinnedModelInfo(compiledConfig, null);

		expect(info).toEqual({
			modelIds: ['model-1', 'model-2'],
			modelNames: ['GPT-4.1', 'Claude Sonnet'],
			label: 'Pinned workflow',
			message:
				'This agent uses pinned models in its workflow (GPT-4.1 and Claude Sonnet), so model switching is unavailable for this chat.'
		});
	});
});
