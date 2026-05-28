// @repo/shared — Components
// Barrel export for shared Svelte components (gen-UI renderers).
//
// Note: Svelte components in this package import Shadcn primitives via
// the `$ui/*` alias. Each consuming SvelteKit app maps `$ui` to its own
// local Shadcn installation via `kit.alias` in svelte.config.js.

export {
	ChartRenderer,
	TableRenderer,
	ConfirmationDialog,
	InputRequestForm,
	MessagePartsRenderer
} from './generative-ui/index';

// Re-export types for convenience
export type {
	ShadcnChartOutput,
	ShadcnChartType,
	ChartSeries,
	CategoryDataPoint,
	PieDataPoint,
	RadarDataPoint,
	RadialDataPoint,
	TableOutput,
	ConfirmationOutput,
	InputRequestOutput,
	ConfirmationInput,
	ConfirmationToolOutput,
	InputRequestInput,
	InputRequestToolOutput,
	MessagePart,
	TextPart,
	ChartPart,
	TablePart,
	ConfirmationPart,
	InputRequestPart,
	ToolPartState
} from './generative-ui/index';
