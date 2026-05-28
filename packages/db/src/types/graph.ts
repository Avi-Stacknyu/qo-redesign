/**
 * Graph Memory Types
 *
 * Types for the user memory graph stored in Neon Postgres.
 * Used by MemoryGraphService and all apps (cf-worker, web, admin).
 */

// ============================================================================
// Node & Edge Types
// ============================================================================

export type NodeType =
  | 'USER'
  | 'AGENT'
  | 'SESSION'
  | 'DOCUMENT'
  | 'FACT'
  | 'ENTITY'
  | 'INTENT'
  | 'TOPIC'
  | 'INSIGHT'
  | 'ACTION_ITEM'
  | 'PROFILE_SECTION'
  // Synced from database
  | 'NOTE'
  | 'TODO'
  | 'REMINDER'
  | 'FILE_REF';

export type EdgeType =
  | 'HAS_SESSION'
  | 'WITH_AGENT'
  | 'UPLOADED'
  | 'HAS_FACT'
  | 'HAS_INTENT'
  | 'HAS_PROFILE_SECTION'
  | 'MENTIONED'
  | 'REVEALS'
  | 'CONTAINS'
  | 'DISCUSSED'
  | 'DERIVED_FROM'
  | 'RELATES_TO'
  // Synced item relationships
  | 'HAS_NOTE'
  | 'HAS_TODO'
  | 'HAS_REMINDER'
  | 'HAS_FILE'
  | 'REFERENCED_IN'
  | 'EXTRACTED_FROM';

export interface GraphNode {
  id: string;
  type: NodeType;
  data: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
  decayScore?: number;
  confidence?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  relationship: EdgeType;
  properties?: Record<string, any>;
  createdAt?: string;
}

// ============================================================================
// Context Types
// ============================================================================

export interface UserContext {
  userId: string;
  facts: GraphNode[];
  activeIntents: GraphNode[];
  recentSessions: GraphNode[];
  actionItems: GraphNode[];
  // Synced items
  notes: GraphNode[];
  todos: GraphNode[];
  reminders: GraphNode[];
  // File references
  chatFiles: GraphNode[]; // Files referenced in current chat
  accessibleFiles: GraphNode[]; // All files accessible to agent
}

// ============================================================================
// Sync Input Types
// ============================================================================

export interface NoteSyncInput {
  pbId: string; // Database record ID
  userId: string;
  title: string;
  content: string;
  tags?: string[];
  includeInMemory: boolean;
  shareWithAdmin: boolean;
  shareWithManager: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TodoSyncInput {
  pbId: string;
  userId: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
  includeInMemory: boolean;
  shareWithAdmin: boolean;
  shareWithManager: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderSyncInput {
  pbId: string;
  userId: string;
  title: string;
  description?: string;
  reminderTime: string;
  recurring?: 'none' | 'daily' | 'weekly' | 'monthly';
  isActive: boolean;
  includeInMemory: boolean;
  shareWithAdmin: boolean;
  shareWithManager: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FileRefSyncInput {
  pbId: string; // user_uploads or ai_system_uploads ID
  userId: string;
  chatId?: string; // If referenced in a specific chat
  filename: string;
  fileType: string;
  vectorIds?: string[]; // Vectorize chunk IDs
  isPrivate: boolean;
  shareWithAgent: boolean;
  shareWithAdmin: boolean;
  shareWithManager: boolean;
  source: 'user' | 'system'; // user_uploads vs ai_system_uploads
  createdAt: string;
  updatedAt: string;
}

export interface PrivacyFilter {
  requestedBy: 'user' | 'agent' | 'admin' | 'manager';
  userId: string;
}

// ============================================================================
// Profile Types (used by profiler system)
// ============================================================================

/** Single field value stored in a profile section node */
export interface ProfileFieldValue {
  value: string;
  /** Display label (from schema definition or LLM-generated for discovered fields) */
  label: string;
  /** Confidence score 0-1 (1.0 for user-provided, 0.8 for chat-extracted) */
  confidence: number;
  source: 'onboarding' | 'chat' | 'user_edit';
  /** true = admin-defined schema key, false = LLM-discovered at runtime */
  isSchema: boolean;
  /** ISO timestamp of last update */
  updatedAt: string;
}

/** Data stored in a PROFILE_SECTION graph node's `data` field */
export interface ProfileSectionData {
  /** Section display label, e.g. "Personal Information" */
  label: string;
  /** Lucide icon name for UI display */
  icon: string;
  /** Sort order for section display */
  order: number;
  /** Map of fieldKey → ProfileFieldValue */
  fields: Record<string, ProfileFieldValue>;
}

/** Shape of a single field update from the profiler LLM */
export interface ProfilerFieldUpdate {
  value: string;
  /** Required for newly discovered fields; optional for schema field updates */
  label?: string;
}

/** What the profiler LLM returns after analyzing messages */
export interface ProfilerResult {
  updates: Array<{
    /** section_id from schema, e.g. "personal", "financial" */
    section: string;
    /** Map of fieldKey → update value */
    fields: Record<string, ProfilerFieldUpdate>;
  }>;
}

/** Individual field definition within a schema section */
export interface ProfileSchemaField {
  /** Stable snake_case key, e.g. "age", "annual_income" */
  key: string;
  /** Human-readable display label */
  label: string;
  type: 'text' | 'number' | 'date' | 'list';
  /** Hint for LLM: what this field represents */
  description?: string;
}

/** Section definition within a profiler schema */
export interface ProfileSchemaSection {
  /** Unique section identifier, e.g. "personal", "financial" */
  section_id: string;
  /** Display label, e.g. "Personal Information" */
  label: string;
  /** Lucide icon name for UI */
  icon: string;
  /** Sort order */
  order: number;
  /** Fields defined in this section */
  fields: ProfileSchemaField[];
}
