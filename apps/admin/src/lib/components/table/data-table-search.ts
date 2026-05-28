export function shouldSubmitTableSearch(event: { key: string; isComposing?: boolean }): boolean {
	return event.key === 'Enter' && !event.isComposing;
}

export function buildApplySearchParams(search: string): Record<string, string> {
	return {
		search: search.trim(),
		page: '1'
	};
}

export function buildClearSearchParams(): Record<string, string> {
	return {
		search: '',
		page: '1'
	};
}
