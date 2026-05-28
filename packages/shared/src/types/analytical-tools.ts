/**
 * Analytical Tools Types
 *
 * Shared types for the analytical tools system — tool definitions, execution
 * requests/results, and input schema descriptors.
 */

import type { ResolvedColumn, ResolvedData, DataSourceRef } from './data-resolver';

// ── Input Schema ─────────────────────────────────────────────────────────────

export type ToolInputFieldType = 'text' | 'number' | 'select' | 'toggle' | 'json' | 'array';

export interface ToolInputField {
  key: string;
  label: string;
  type: ToolInputFieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  defaultValue?: unknown;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
  placeholder?: string;
}

export type ToolInputSchema = ToolInputField[];

// ── Output Config ────────────────────────────────────────────────────────────

export type ChartType = 'pie' | 'bar' | 'line' | 'area' | 'scatter' | 'treemap';

export interface ToolOutputConfig {
  suggested_charts: ChartType[];
  primary_output: 'chart' | 'table' | 'metrics';
  columns?: ResolvedColumn[];
}

// ── Execution ────────────────────────────────────────────────────────────────

export interface ToolExecutionRequest {
  tool_key: string;
  input_params: Record<string, unknown>;
  user_id: string;
}

export interface SuggestedVisualization {
  chart_type: ChartType;
  data_key: string;
  title: string;
}

export interface ToolExecutionResult {
  data: Record<string, ResolvedData>;
  data_source_ref: DataSourceRef;
  visualizations: SuggestedVisualization[];
  metrics?: Record<string, unknown>;
}

// ── Catalog Item (returned to web) ───────────────────────────────────────────

export interface AnalyticalToolCatalogItem {
  id: string;
  tool_key: string;
  display_name: string;
  description: string;
  category: string;
  icon: string;
  input_schema: ToolInputSchema;
  output_config: ToolOutputConfig | null;
}
