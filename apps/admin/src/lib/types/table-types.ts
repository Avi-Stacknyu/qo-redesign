import type { ColumnDef } from '@tanstack/table-core';

export type CustomFilters = {
	disableSearch?: null | boolean; // Optional flag for disabling search
	facetedFilters?: Array<{
		column: string; // The column name associated with the filter
		title: string; // The header/title of the filter
		options: { label: string; value: string | number }[]; // An array of options (either strings or objects with label and value)
	}> | null; // An array of faceted filters or null
} | null;
