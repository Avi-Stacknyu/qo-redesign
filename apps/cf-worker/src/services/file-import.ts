/**
 * File Import Service
 *
 * Parses uploaded files (CSV, JSON, markdown tables) into generic ResolvedData.
 * Column types are auto-detected: date, number, or string.
 */

import Papa from 'papaparse';
import type { ResolvedColumn, ResolvedData } from '@repo/shared/types';

// ---------------------------------------------------------------------------
// Column type inference
// ---------------------------------------------------------------------------

const DATE_PATTERNS = [
	/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?/, // ISO 8601
	/^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY or DD/MM/YYYY
	/^\d{2}-\d{2}-\d{4}$/ // DD-MM-YYYY
];

function isDateValue(v: unknown): boolean {
	if (typeof v !== 'string' || !v) return false;
	return DATE_PATTERNS.some((p) => p.test(v.trim()));
}

function isNumericValue(v: unknown): boolean {
	if (typeof v === 'number') return true;
	if (typeof v !== 'string' || !v.trim()) return false;
	// Strip optional currency/percentage symbols
	const cleaned = v
		.trim()
		.replace(/^[₹$€£¥%]|[₹$€£¥%]$/g, '')
		.replace(/,/g, '')
		.trim();
	return cleaned !== '' && !isNaN(Number(cleaned));
}

function inferColumnType(values: unknown[]): ResolvedColumn['type'] {
	const nonEmpty = values.filter((v) => v != null && v !== '');
	if (nonEmpty.length === 0) return 'string';

	const sample = nonEmpty.slice(0, 50);
	const dateCount = sample.filter(isDateValue).length;
	if (dateCount / sample.length > 0.7) return 'date';

	const numCount = sample.filter(isNumericValue).length;
	if (numCount / sample.length > 0.7) return 'number';

	return 'string';
}

function buildColumns(keys: string[], rows: Record<string, unknown>[]): ResolvedColumn[] {
	return keys.map((key) => ({
		key,
		label: key.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
		type: inferColumnType(rows.map((r) => r[key]))
	}));
}

// ---------------------------------------------------------------------------
// CSV parser
// ---------------------------------------------------------------------------

function parseCsv(text: string): ResolvedData {
	const result = Papa.parse<Record<string, string>>(text, {
		header: true,
		skipEmptyLines: true,
		transformHeader: (h) => h.trim()
	});

	if (!result.data.length || !result.meta.fields?.length) {
		throw new Error('CSV file has no usable rows or headers');
	}

	const keys = result.meta.fields;
	const rows = result.data as Record<string, unknown>[];
	return { columns: buildColumns(keys, rows), rows };
}

// ---------------------------------------------------------------------------
// JSON parser (array-of-objects)
// ---------------------------------------------------------------------------

function parseJson(text: string): ResolvedData {
	const parsed: unknown = JSON.parse(text);
	const arr = Array.isArray(parsed) ? parsed : (parsed as Record<string, unknown>).data;

	if (!Array.isArray(arr) || arr.length === 0) {
		throw new Error('JSON must be an array of objects (or { data: [...] })');
	}

	const first = arr[0];
	if (typeof first !== 'object' || first === null) {
		throw new Error('JSON array items must be objects');
	}

	const keys = Object.keys(first);
	const rows = arr as Record<string, unknown>[];
	return { columns: buildColumns(keys, rows), rows };
}

// ---------------------------------------------------------------------------
// Markdown table parser (for Cloudflare AI toMarkdown output)
// ---------------------------------------------------------------------------

function parseMarkdownTable(text: string): ResolvedData {
	const lines = text
		.split('\n')
		.map((l) => l.trim())
		.filter((l) => l.startsWith('|'));

	if (lines.length < 2) {
		throw new Error('No markdown table detected');
	}

	const splitRow = (line: string) =>
		line
			.split('|')
			.slice(1, -1)
			.map((c) => c.trim());

	const headers = splitRow(lines[0]);

	// Skip separator row (---|---) — it's always index 1
	const dataLines = lines.slice(2);
	const rows: Record<string, unknown>[] = dataLines.map((line) => {
		const cells = splitRow(line);
		const row: Record<string, unknown> = {};
		headers.forEach((h, i) => {
			row[h] = cells[i] ?? '';
		});
		return row;
	});

	if (!rows.length) throw new Error('Markdown table has no data rows');

	return { columns: buildColumns(headers, rows), rows };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function parseUploadedFile(text: string, mimeType: string, fileName: string): ResolvedData {
	const ext = fileName.split('.').pop()?.toLowerCase() ?? '';

	if (mimeType === 'application/json' || ext === 'json') {
		return parseJson(text);
	}

	if (mimeType === 'text/csv' || mimeType === 'application/csv' || ext === 'csv') {
		return parseCsv(text);
	}

	// Fallback: try markdown table (for AI-converted Excel/PDF output)
	if (text.includes('|') && text.includes('---')) {
		return parseMarkdownTable(text);
	}

	// Last resort: try CSV heuristic (tab or comma separated)
	return parseCsv(text);
}
