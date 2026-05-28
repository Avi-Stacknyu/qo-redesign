import { getPaginatedData } from '$lib/functions/pagination';
import { aiAgentModels, aiProviders, aiAgentModelsSupportedTools } from '@repo/db/schema';
import { sql, inArray } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import {
	buildModelTableItems,
	modelTableSelection,
	type ModelTableProviderRow,
	type ModelTableSourceRow
} from './model-page-data';

export const load: PageServerLoad = async (event) => {
	const db = event.locals.db;

	const tableData = (await getPaginatedData<typeof aiAgentModels>({
		id: 'models_table',
		loadUrl: event.url,
		cookies: event.cookies,
		db,
		table: aiAgentModels,
		select: modelTableSelection,
		searchFilters: ['display_name', 'model_id'],
		sortKey: '-created',
		defaultFilter: sql`${aiAgentModels.configKey} = '' OR ${aiAgentModels.configKey} IS NULL`
	})) as {
		items: ModelTableSourceRow[];
		totalItems: number;
		totalPages: number;
		page: number;
		perPage: number;
	};

	if (tableData.items.length === 0) return { tableData };

	const modelIds = tableData.items.map((m) => m.id);
	const providerIds = [
		...new Set(tableData.items.map((m) => m.provider).filter(Boolean))
	] as string[];

	const [providers, toolCounts] = await Promise.all([
		providerIds.length > 0
			? db
					.select({
						id: aiProviders.id,
						providerKey: aiProviders.providerKey,
						displayName: aiProviders.displayName,
						logo: aiProviders.logo
					})
					.from(aiProviders)
					.where(inArray(aiProviders.id, providerIds))
			: [],
		modelIds.length > 0
			? db
					.select({
						modelId: aiAgentModelsSupportedTools.sourceId,
						count: sql<number>`count(*)::int`
					})
					.from(aiAgentModelsSupportedTools)
					.where(inArray(aiAgentModelsSupportedTools.sourceId, modelIds))
					.groupBy(aiAgentModelsSupportedTools.sourceId)
			: []
	]);

	return {
		tableData: {
			...tableData,
			items: buildModelTableItems({
				models: tableData.items,
				providers: providers as ModelTableProviderRow[],
				toolCounts
			})
		}
	};
};
