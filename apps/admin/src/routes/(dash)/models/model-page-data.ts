import { aiAgentModels, aiProviders } from '@repo/db/schema';

export const modelTableSelection = {
	id: aiAgentModels.id,
	modelId: aiAgentModels.modelId,
	displayName: aiAgentModels.displayName,
	description: aiAgentModels.description,
	isActive: aiAgentModels.isActive,
	isSystemDefault: aiAgentModels.isSystemDefault,
	provider: aiAgentModels.provider,
	syncStatus: aiAgentModels.syncStatus
};

export const modelEditorSelection = {
	id: aiAgentModels.id,
	modelId: aiAgentModels.modelId,
	displayName: aiAgentModels.displayName,
	description: aiAgentModels.description,
	isActive: aiAgentModels.isActive,
	isEnabled: aiAgentModels.isEnabled,
	provider: aiAgentModels.provider,
	optionsSchema: aiAgentModels.optionsSchema,
	defaultOptions: aiAgentModels.defaultOptions,
	capabilities: aiAgentModels.capabilities,
	contextWindow: aiAgentModels.contextWindow,
	maxOutputTokens: aiAgentModels.maxOutputTokens,
	isSystemDefault: aiAgentModels.isSystemDefault,
	tagRule: aiAgentModels.tagRule
};

export interface ModelTableSourceRow {
	id: string;
	modelId: string | null;
	displayName: string | null;
	description: string | null;
	isActive: boolean | null;
	isSystemDefault: boolean | null;
	provider: string | null;
	syncStatus: string | null;
}

export interface ModelTableProviderRow {
	id: string;
	providerKey: string | null;
	displayName: string | null;
	logo: string | null;
	[key: string]: unknown;
}

export interface ModelToolCountRow {
	modelId: string;
	count: number;
}

export interface ModelTableItem extends ModelTableSourceRow {
	expand: {
		provider?: Pick<ModelTableProviderRow, 'id' | 'providerKey' | 'displayName' | 'logo'>;
		supportedToolCount: number;
	};
}

export interface ModelEditorSourceRow {
	id: string;
	modelId: string | null;
	displayName: string | null;
	description: string | null;
	isActive: boolean | null;
	isEnabled: boolean | null;
	provider: string | null;
	optionsSchema: unknown;
	defaultOptions: unknown;
	capabilities: unknown;
	contextWindow: string | null;
	maxOutputTokens: string | null;
	isSystemDefault: boolean | null;
	tagRule: unknown;
	[key: string]: unknown;
}

export interface ModelEditorData {
	id: string;
	modelId: string | null;
	displayName: string | null;
	description: string | null;
	isActive: boolean | null;
	isEnabled: boolean | null;
	provider: string | null;
	optionsSchema: unknown;
	defaultOptions: unknown;
	capabilities: unknown;
	contextWindow: string | null;
	maxOutputTokens: string | null;
	isSystemDefault: boolean | null;
	tagRule: unknown;
	supportedToolIds: string[];
}

export function buildModelTableItems({
	models,
	providers,
	toolCounts
}: {
	models: ModelTableSourceRow[];
	providers: ModelTableProviderRow[];
	toolCounts: ModelToolCountRow[];
}): ModelTableItem[] {
	const providerMap = new Map(
		providers.map((provider) => [
			provider.id,
			{
				id: provider.id,
				providerKey: provider.providerKey,
				displayName: provider.displayName,
				logo: provider.logo
			}
		])
	);
	const toolCountMap = new Map(toolCounts.map((row) => [row.modelId, row.count]));

	return models.map((model) => ({
		...model,
		expand: {
			provider: model.provider ? providerMap.get(model.provider) : undefined,
			supportedToolCount: toolCountMap.get(model.id) ?? 0
		}
	}));
}

export function buildModelEditorData(
	model: ModelEditorSourceRow | null | undefined,
	supportedToolIds: string[]
): ModelEditorData | null {
	if (!model) return null;

	return {
		id: model.id,
		modelId: model.modelId,
		displayName: model.displayName,
		description: model.description,
		isActive: model.isActive,
		isEnabled: model.isEnabled,
		provider: model.provider,
		optionsSchema: model.optionsSchema,
		defaultOptions: model.defaultOptions,
		capabilities: model.capabilities,
		contextWindow: model.contextWindow,
		maxOutputTokens: model.maxOutputTokens,
		isSystemDefault: model.isSystemDefault,
		tagRule: model.tagRule,
		supportedToolIds
	};
}
