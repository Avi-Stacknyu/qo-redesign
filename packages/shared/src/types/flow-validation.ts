/**
 * Flow Validation & Compilation Types
 * Types used by the flow validator and compiler (runs on worker in Phase 4).
 *
 * Extracted from apps/admin/src/lib/utils/flow/types.ts
 */

import type { FlowNodeType } from './flow';

// ============================================================================
// Validation Types
// ============================================================================

export type ValidationErrorCode =
  // Structure errors
  | 'NO_START_NODE'
  | 'MULTIPLE_START_NODES'
  | 'NO_END_NODE'
  | 'DISCONNECTED_NODE'
  | 'UNREACHABLE_NODE'
  | 'DEAD_END_NODE'
  | 'MAX_NODES_EXCEEDED'
  | 'MAX_DEPTH_EXCEEDED'
  // Connection errors
  | 'INVALID_CONNECTION'
  | 'SELF_LOOP'
  | 'CLASSIFIER_INCOMPLETE'
  | 'MULTIPLE_INCOMING_TO_END'
  // Parallel branch errors
  | 'PARALLEL_NO_SUCCESS_END'
  | 'PARALLEL_MULTIPLE_SUCCESS_ENDS'
  // Configuration errors
  | 'LLM_NO_MODEL'
  | 'INVALID_MODEL_ID'
  | 'INVALID_TOOL_ID'
  | 'CLASSIFIER_NO_CATEGORIES'
  | 'CLASSIFIER_EMPTY_CATEGORY'
  | 'MISSING_REQUIRED_FIELD'
  | 'HYBRID_MISSING_SUMMARIZATION';

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationError {
  code: ValidationErrorCode;
  message: string;
  severity: ValidationSeverity;
  nodeId?: string;
  field?: string;
}

export interface ValidationResult {
  status: 'valid' | 'invalid' | 'warning';
  errors: ValidationError[];
}

export interface ValidationContext {
  availableModelIds: string[];
  availableToolIds: string[];
}

// ============================================================================
// Compilation Context (data needed from DB to compile)
// ============================================================================

export interface CompilationContext {
  // Models with their providers and config
  models: Array<{
    id: string;
    model_id: string; // The actual model key (e.g., "gpt-4o")
    display_name: string;
    provider: {
      id: string;
      provider_key: string;
    };
    current_pricing?: string;
    // Model config
    context_window?: number;
    max_output_tokens?: number;
    default_options?: Record<string, unknown>;
    capabilities?: Record<string, unknown>;
  }>;
  // Tools with full details
  tools: Array<{
    id: string;
    tool_key: string;
    display_name: string;
    description?: string;
    tool_type: 'sdk' | 'builtin';
    sdk_tool_name?: string; // For SDK tools - the SDK action name
    default_config?: Record<string, unknown>;
    // For SDK tools - the provider that owns this tool
    provider?: {
      id: string;
      provider_key: string; // e.g., "google", "anthropic", "openai", "xai"
    };
  }>;
}

// ============================================================================
// Worker RPC Response (Phase 4)
// ============================================================================

export interface ValidateAndCompileResult {
  validationStatus: 'valid' | 'invalid' | 'warning';
  validationErrors: ValidationError[];
  compiledConfig?: import('./flow').CompiledFlowConfig;
}
