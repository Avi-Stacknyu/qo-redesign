import { describe, expect, test } from 'vitest';

import {
	buildApplySearchParams,
	buildClearSearchParams,
	shouldSubmitTableSearch
} from './data-table-search';

describe('data-table-search', () => {
	test('submits search on Enter keydown only', () => {
		expect(shouldSubmitTableSearch({ key: 'Enter', isComposing: false })).toBe(true);
		expect(shouldSubmitTableSearch({ key: 'Enter', isComposing: true })).toBe(false);
		expect(shouldSubmitTableSearch({ key: 'a', isComposing: false })).toBe(false);
	});

	test('trims search input and resets pagination', () => {
		expect(buildApplySearchParams('  sonnet  ')).toEqual({
			search: 'sonnet',
			page: '1'
		});
	});

	test('clearing search removes the term and resets pagination', () => {
		expect(buildClearSearchParams()).toEqual({
			search: '',
			page: '1'
		});
	});
});
