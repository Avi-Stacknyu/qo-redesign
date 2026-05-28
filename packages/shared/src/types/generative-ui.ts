/**
 * Generative UI Types
 * Types for AI-generated UI components rendered in chat messages
 *
 * Canonical source: extracted from apps/web — includes `expired` state,
 * typed HIL input/output, and `button_select` input type.
 */

// Chart types
export type ShadcnChartType = 'area' | 'bar' | 'line' | 'pie' | 'radar' | 'radial';

// Series configuration for multi-series charts
export interface ChartSeries {
  key: string;
  label: string;
  color?: string; // hex color or CSS variable like 'var(--chart-1)'
}

// Data point types
export interface CategoryDataPoint {
  [key: string]: string | number;
}

export interface PieDataPoint {
  name: string;
  value: number;
  color?: string;
}

export interface RadarDataPoint {
  category: string;
  [key: string]: string | number;
}

export interface RadialDataPoint {
  name: string;
  value: number;
  fill?: string;
}

// Full chart output structure
export interface ShadcnChartOutput {
  _toolType: 'chart';
  chartType: ShadcnChartType;
  title: string;
  description?: string;
  footer?: string;
  data: CategoryDataPoint[] | PieDataPoint[] | RadarDataPoint[] | RadialDataPoint[];
  series?: ChartSeries[];
  config: {
    xKey?: string;
    showLegend?: boolean;
    showTooltip?: boolean;
    showGrid?: boolean;
    stacked?: boolean;
    horizontal?: boolean;
    donut?: boolean;
    startAngle?: number;
    endAngle?: number;
    innerRadius?: number;
  };
}

// Table output structure
export interface TableOutput {
  _toolType: 'table';
  title: string;
  description?: string;
  columns: Array<{
    key: string;
    label: string;
    align?: 'left' | 'center' | 'right';
  }>;
  rows: Array<Record<string, string | number | boolean>>;
}

// Confirmation output structure
export interface ConfirmationOutput {
  _toolType: 'confirmation';
  status: 'awaiting_confirmation' | 'confirmed' | 'cancelled';
  message: string;
  action_description: string;
  severity: 'info' | 'warning' | 'danger';
  confirmed?: boolean;
}

// Dashboard update output structure (returned by all dashboard agent tools)
export interface DashboardUpdateOutput {
  _toolType: 'dashboard_update';
  action: string;
  [key: string]: unknown;
}

// Input request output structure
export interface InputRequestOutput {
  _toolType: 'input_request';
  status: 'awaiting_input' | 'submitted';
  prompt: string;
  input_type: 'text' | 'number' | 'date' | 'select';
  options?: string[];
  placeholder?: string;
  required: boolean;
  value?: string;
}

// AI SDK Tool Part States
// Maps 1:1 to AI SDK's ToolUIPart state machine:
//   input-streaming → input-available → output-available | output-error
// 'expired' is a custom state for historical HIL parts that were never answered
export type ToolPartState =
  | 'input-streaming'
  | 'input-available'
  | 'output-available'
  | 'output-error'
  | 'expired';

// Message part types for rendering
export type MessagePartType =
  | 'text'
  | 'tool-display_chart'
  | 'tool-display_table'
  | 'tool-ask_confirmation'
  | 'tool-request_input'
  | 'tool-dashboard_update';

export interface TextPart {
  type: 'text';
  text: string;
}

export interface ChartPart {
  type: 'tool-display_chart';
  state: ToolPartState;
  toolCallId: string;
  output?: ShadcnChartOutput;
  errorText?: string;
}

export interface TablePart {
  type: 'tool-display_table';
  state: ToolPartState;
  toolCallId: string;
  output?: TableOutput;
  errorText?: string;
}

/** Tool call input for ask_confirmation (what the model sends) */
export interface ConfirmationInput {
  message: string;
  action_description: string;
  severity?: 'info' | 'warning' | 'danger';
}

/** Tool output for ask_confirmation (what addToolOutput sends back) */
export interface ConfirmationToolOutput {
  confirmed: boolean;
  message: string;
}

export interface ConfirmationPart {
  type: 'tool-ask_confirmation';
  state: ToolPartState;
  toolCallId: string;
  input?: ConfirmationInput;
  output?: ConfirmationToolOutput;
  errorText?: string;
}

/** Tool call input for request_input (what the model sends) */
export interface InputRequestInput {
  prompt: string;
  input_type?: 'text' | 'number' | 'date' | 'select' | 'button_select';
  options?: string[];
  placeholder?: string;
  required?: boolean;
}

/** Tool output for request_input (what addToolOutput sends back) */
export interface InputRequestToolOutput {
  value: string;
}

export interface InputRequestPart {
  type: 'tool-request_input';
  state: ToolPartState;
  toolCallId: string;
  input?: InputRequestInput;
  output?: InputRequestToolOutput;
  errorText?: string;
}

export interface DashboardUpdatePart {
  type: 'tool-dashboard_update';
  state: ToolPartState;
  toolCallId: string;
  output?: DashboardUpdateOutput;
  errorText?: string;
}

export type MessagePart = TextPart | ChartPart | TablePart | ConfirmationPart | InputRequestPart | DashboardUpdatePart;

// Utility type guard functions
export function isChartOutput(output: unknown): output is ShadcnChartOutput {
  return (
    typeof output === 'object' &&
    output !== null &&
    '_toolType' in output &&
    (output as { _toolType: string })._toolType === 'chart'
  );
}

export function isTableOutput(output: unknown): output is TableOutput {
  return (
    typeof output === 'object' &&
    output !== null &&
    '_toolType' in output &&
    (output as { _toolType: string })._toolType === 'table'
  );
}

export function isConfirmationOutput(output: unknown): output is ConfirmationOutput {
  return (
    typeof output === 'object' &&
    output !== null &&
    '_toolType' in output &&
    (output as { _toolType: string })._toolType === 'confirmation'
  );
}

export function isInputRequestOutput(output: unknown): output is InputRequestOutput {
  return (
    typeof output === 'object' &&
    output !== null &&
    '_toolType' in output &&
    (output as { _toolType: string })._toolType === 'input_request'
  );
}

export function isDashboardUpdateOutput(output: unknown): output is DashboardUpdateOutput {
  return (
    typeof output === 'object' &&
    output !== null &&
    '_toolType' in output &&
    ((output as { _toolType: string })._toolType === 'dashboard_update' ||
     (output as { _toolType: string })._toolType === 'dashboard_state')
  );
}

/** AI SDK tool names for dashboard tools — mapped to 'tool-dashboard_update' part type */
export const DASHBOARD_TOOL_NAMES = new Set([
  'get_dashboard_state',
  'add_dashboard_widget',
  'remove_dashboard_widget',
  'update_dashboard_widget',
  'reorder_dashboard_widgets',
  'update_dashboard_theme',
  'create_widget_data'
]);
