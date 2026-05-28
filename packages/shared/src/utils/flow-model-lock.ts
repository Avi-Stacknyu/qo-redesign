import type { CompiledFlowConfig, FlowData } from '../types';

export type PinnedModelInfo = {
  modelIds: string[];
  modelNames: string[];
  label: string;
  message: string;
};

const EXECUTION_NODE_TYPES = new Set(['llm', 'classifier']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function uniqueStrings(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function collectCompiledPinnedModelIds(compiledConfig: unknown): string[] {
  if (!isRecord(compiledConfig) || !isRecord(compiledConfig.nodes)) return [];

  return uniqueStrings(
    Object.values(compiledConfig.nodes).map((node) => {
      if (!isRecord(node)) return null;
      if (!EXECUTION_NODE_TYPES.has(toNonEmptyString(node.type) ?? '')) return null;
      if (!isRecord(node.config)) return null;
      return toNonEmptyString(node.config.model_id);
    })
  );
}

function collectFlowPinnedModelIds(flowData: unknown): string[] {
  if (!isRecord(flowData) || !Array.isArray(flowData.nodes)) return [];

  return uniqueStrings(
    flowData.nodes.map((node) => {
      if (!isRecord(node)) return null;
      if (!EXECUTION_NODE_TYPES.has(toNonEmptyString(node.type) ?? '')) return null;
      if (!isRecord(node.data)) return null;
      return toNonEmptyString(node.data.model_id);
    })
  );
}

function resolveCompiledModelName(compiledConfig: unknown, modelId: string): string | null {
  if (!isRecord(compiledConfig) || !isRecord(compiledConfig.resolved)) return null;
  if (!isRecord(compiledConfig.resolved.models)) return null;
  const model = compiledConfig.resolved.models[modelId];
  if (!isRecord(model)) return null;
  return toNonEmptyString(model.display_name);
}

function formatModelNames(modelNames: string[]): string {
  if (modelNames.length <= 1) return modelNames[0] ?? '';
  if (modelNames.length === 2) return `${modelNames[0]} and ${modelNames[1]}`;
  return `${modelNames.slice(0, -1).join(', ')}, and ${modelNames.at(-1)}`;
}

export function getPinnedModelInfo(
  compiledConfig?: CompiledFlowConfig | null,
  flowData?: FlowData | null
): PinnedModelInfo | null {
  const modelIds = uniqueStrings([
    ...collectCompiledPinnedModelIds(compiledConfig),
    ...collectFlowPinnedModelIds(flowData)
  ]);

  if (modelIds.length === 0) return null;

  const modelNames = uniqueStrings(
    modelIds.map((modelId) => resolveCompiledModelName(compiledConfig, modelId))
  );
  const singleModelName = modelNames.length === 1 ? modelNames[0] : null;

  if (singleModelName) {
    return {
      modelIds,
      modelNames,
      label: `Best with ${singleModelName}`,
      message: `This agent is configured to work best with ${singleModelName}, so model switching is unavailable for this chat.`
    };
  }

  return {
    modelIds,
    modelNames,
    label: 'Pinned workflow',
    message:
      modelNames.length > 1
        ? `This agent uses pinned models in its workflow (${formatModelNames(modelNames)}), so model switching is unavailable for this chat.`
        : 'This agent uses pinned models in its workflow, so model switching is unavailable for this chat.'
  };
}
