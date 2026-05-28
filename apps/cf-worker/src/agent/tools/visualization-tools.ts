import { z } from 'zod';
import { tool } from 'ai';
import type { ToolContext } from './types';

// ============================================================================
// Visualization Types (Generative UI) - shadcn-svelte Charts
// ============================================================================

/**
 * Shadcn-svelte Chart Types
 * Based on: https://www.shadcn-svelte.com/charts
 * Uses LayerChart under the hood
 */
export type ShadcnChartType = 'area' | 'bar' | 'line' | 'pie' | 'radar' | 'radial';

/**
 * Series configuration for multi-series charts
 * Maps to chartConfig in shadcn-svelte
 */
export interface ChartSeries {
	key: string;
	label: string;
	color?: string; // hex color or CSS variable like 'var(--chart-1)'
}

/**
 * Data point for category-based charts (bar, line, area)
 */
export interface CategoryDataPoint {
	[key: string]: string | number;
}

/**
 * Data point for pie/donut charts
 */
export interface PieDataPoint {
	name: string;
	value: number;
	color?: string;
}

/**
 * Data point for radar charts
 */
export interface RadarDataPoint {
	category: string;
	[key: string]: string | number;
}

/**
 * Data point for radial/gauge charts
 */
export interface RadialDataPoint {
	name: string;
	value: number;
	fill?: string;
}

/**
 * Chart output structure - passed to frontend for rendering
 */
export interface ShadcnChartOutput {
	_toolType: 'chart';
	chartType: ShadcnChartType;
	title: string;
	description?: string;
	footer?: string;
	data: CategoryDataPoint[] | PieDataPoint[] | RadarDataPoint[] | RadialDataPoint[];
	series?: ChartSeries[];
	config: {
		xKey?: string; // Key for x-axis (category-based charts)
		showLegend?: boolean;
		showTooltip?: boolean;
		showGrid?: boolean;
		stacked?: boolean; // For bar/area charts
		horizontal?: boolean; // For bar charts
		donut?: boolean; // For pie charts (ring style)
		startAngle?: number; // For radial charts
		endAngle?: number;
	};
}

export function createVisualizationTools(_ctx: ToolContext) {
	return {
		/**
		 * Display a chart visualization using shadcn-svelte charts
		 * Supports: Area, Bar, Line, Pie, Radar, Radial charts
		 * Reference: https://www.shadcn-svelte.com/charts
		 */
		display_chart: tool({
			description: `Display a chart or visualization to the user using shadcn-svelte charts (LayerChart).

IMPORTANT: When using this tool, do NOT describe the chart data in your text response - the tool renders the visualization for you. Only include brief context or insights about what the chart shows.

Supported chart types:
- area: For cumulative trends over time (e.g., revenue growth, user acquisition)
- bar: For comparing categories or values (e.g., monthly sales, browser stats)
- line: For trends over time (e.g., stock prices, temperature changes)
- pie: For proportions/percentages (e.g., market share, budget breakdown). Use donut:true for ring style.
- radar: For multi-dimensional comparisons (e.g., skill assessments, product features)
- radial: For progress/gauge displays (e.g., goal completion, scores)

Data format depends on chart type:
- For area/bar/line: Array of objects with a category key and value keys for each series
  Example: [{ month: "Jan", desktop: 186, mobile: 80 }, { month: "Feb", desktop: 305, mobile: 200 }]
  
- For pie: Array of { name, value, color? }
  Example: [{ name: "Chrome", value: 275 }, { name: "Safari", value: 200 }]
  
- For radar: Array with category and series values
  Example: [{ category: "Speed", desktop: 80, mobile: 60 }, { category: "Battery", desktop: 70, mobile: 90 }]
  
- For radial: Array of { name, value, fill? }
  Example: [{ name: "Progress", value: 75, fill: "var(--chart-1)" }]

Series config defines labels and colors for multi-series charts.`,
			inputSchema: z.object({
				chartType: z
					.enum(['area', 'bar', 'line', 'pie', 'radar', 'radial'])
					.describe('The type of chart to display'),
				title: z.string().describe('Chart title displayed above the chart'),
				description: z.string().optional().describe('Subtitle/description below the title'),
				footer: z
					.string()
					.optional()
					.describe('Footer text below the chart (e.g., "Trending up 5.2%")'),
				// Use explicit object with properties to ensure proper JSON Schema items generation
				data: z
					.array(
						z
							.object({
								name: z.string().optional(),
								value: z.number().optional(),
								category: z.string().optional()
							})
							.passthrough()
					)
					.describe('Array of data points - format depends on chart type'),
				series: z
					.array(
						z.object({
							key: z.string().describe('Data key (must match keys in data objects)'),
							label: z.string().describe('Human-readable label for legend/tooltip'),
							color: z
								.string()
								.optional()
								.describe('Color: hex (#2563eb) or CSS var (var(--chart-1))')
						})
					)
					.optional()
					.describe('Series configuration for multi-series charts'),
				config: z
					.object({
						xKey: z.string().optional().describe('Key for x-axis categories (e.g., "month")'),
						showLegend: z.boolean().optional().describe('Show chart legend'),
						showTooltip: z.boolean().optional().describe('Show tooltips on hover'),
						showGrid: z.boolean().optional().describe('Show grid lines'),
						stacked: z.boolean().optional().describe('Stack series (bar/area charts)'),
						horizontal: z.boolean().optional().describe('Horizontal orientation (bar charts)'),
						donut: z.boolean().optional().describe('Ring style (pie charts)'),
						startAngle: z.number().optional().describe('Start angle in degrees (radial charts)'),
						endAngle: z.number().optional().describe('End angle in degrees (radial charts)')
					})
					.optional()
					.describe('Chart configuration options')
			}),
			execute: async (input) => ({
				_toolType: 'chart' as const,
				...input
			})
		}),

		/**
		 * Display data in a formatted table
		 */
		display_table: tool({
			description:
				'Display data in a formatted, interactive table component. Use this for presenting structured data. IMPORTANT: When using this tool, do NOT also include the same data as a markdown table in your text response - the tool renders the table for you. Only include brief introductory text before calling the tool.',
			inputSchema: z.object({
				title: z.string().describe('Table title'),
				description: z.string().optional().describe('Table description'),
				columns: z
					.array(
						z.object({
							key: z.string().describe('Column key (matches row data keys)'),
							label: z.string().describe('Column header label'),
							align: z.enum(['left', 'center', 'right']).optional().describe('Text alignment')
						})
					)
					.describe('Column definitions'),
				// Use explicit object with properties to ensure proper JSON Schema items generation
				rows: z
					.array(
						z
							.object({
								id: z.string().optional()
							})
							.passthrough()
					)
					.describe('Array of row data objects')
			}),
			execute: async (input) => ({
				_toolType: 'table' as const,
				...input
			})
		})
	};
}
