export type LandingSuggestion = {
	title: string;
	prompt: string;
};

type LandingSuggestionSource = LandingSuggestion & {
	description?: string;
	icon?: string;
};

export const DEFAULT_LANDING_SUGGESTIONS: LandingSuggestion[] = [
	{
		title: 'Financial Analysis',
		prompt: "Analyze this quarter's financial performance and provide key insights"
	},
	{
		title: 'Tax Planning',
		prompt: 'Create a comprehensive tax optimization strategy'
	},
	{
		title: 'Market Research',
		prompt: 'Research the latest trends in sustainable investing'
	},
	{
		title: 'Portfolio Review',
		prompt: 'Review my investment portfolio and suggest rebalancing'
	}
];

export function normalizeLandingSuggestions(
	suggestions: LandingSuggestionSource[]
): LandingSuggestion[] {
	return suggestions.slice(0, 4).map(({ title, prompt }) => ({ title, prompt }));
}