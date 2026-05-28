// @repo/shared — Types
// Barrel export for all shared type definitions.

// Generative UI types (canonical: web)
export * from './generative-ui';

// Flow types (canonical: cf-worker)
export * from './flow';

// Flow validation & compilation types (canonical: admin + worker)
export * from './flow-validation';

// Chat-specific shared types
export * from './chat';

// Universal tag rule types (tag gating system)
export * from './tag-rules';

// Widget data resolver types (data source references, resolved data)
export * from './data-resolver';

// Widget config types (shared between admin + web)
export * from './widget-config';

// Analytical tools types (tool definitions, execution, input schemas)
export * from './analytical-tools';

// RPC interface types (service binding contracts for CF_WORKER, FILE_SERVICE, QUANT_AGENT)
export * from './rpc';
