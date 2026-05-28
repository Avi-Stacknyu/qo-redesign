/**
 * Canonical RPC interface types for Cloudflare service binding calls.
 *
 * These are the single source of truth for:
 *   - Worker class public methods  (CF_WORKER binding)
 *   - FileServiceEntrypoint methods (FILE_SERVICE binding)
 *   - QuantPMAgent DO methods       (QUANT_AGENT binding)
 *
 * Both apps/admin and apps/web import these instead of maintaining
 * hand-written stubs in their app.d.ts files.
 * apps/cf-worker implements these interfaces for compile-time drift detection.
 */

import type {
  ValidateAndCompileResult,
  DataSourceRef,
  DataSourceCatalogItem,
  ResolvedData,
  ToolExecutionResult,
  TagRule
} from './index';

import type { PinnedModelInfo } from '../utils/flow-model-lock';

// ── File Service shared types ────────────────────────────────────────────────

export type UploadScope = 'user' | 'system';

export interface UploadResult {
  id: string;
  name: string;
  path: string;
  type: string;
  size: number;
  processingId: string;
}

export interface DeleteResult {
  success: boolean;
  deletedVectorIds: string[];
  deletedGraphNodeIds: string[];
}

// ── Agent search result (returned by getContext / hybridSearch) ───────────────

export interface AgentSearchResult {
  id: string;
  text: string;
  context?: string;
  vectorScore?: number;
  ftsRank?: number;
  rrfScore?: number;
  rerankerScore?: number;
  normalizedScore?: number;
  source: 'vector' | 'fts' | 'hybrid';
  metadata?: Record<string, unknown>;
}

// ── QuantPMAgent (Durable Object) RPC ────────────────────────────────────────

export interface QuantPMAgentRpc {
  chat(params: {
    message: string;
    userId: string;
    sessionId?: string;
    agentId?: string;
    chatId?: string;
    attachedFiles?: Array<{ id: string; name: string; type: string; size: number }>;
    ragConfig?: Record<string, unknown>;
    agentStatus?: 'active' | 'inactive' | 'development';
    cfHeaders?: Record<string, string>;
    modelOverrideId?: string;
    toolResults?: Array<{
      toolCallId: string;
      toolName: string;
      args: unknown;
      output: unknown;
      providerMetadata?: Record<string, unknown>;
    }>;
    assistantText?: string;
    respondMessageId?: string;
  }): Promise<Response>;

  flushPending(params: {
    chatId: string;
    userId: string;
    agentId: string;
  }): Promise<{ flushed: number }>;

  getContext(params: { userId: string; message?: string }): Promise<{
    userContext: unknown;
    relevantDocs: AgentSearchResult[];
    relevantKnowledge: AgentSearchResult[];
    attachedFileSummaries: Array<{ fileId: string; fileName: string; summary: string }>;
  }>;

  hybridSearch(params: { query: string; userId: string; topK?: number }): Promise<{
    documents: AgentSearchResult[];
    knowledge: AgentSearchResult[];
  }>;
}

// ── OrionWorkerRpc (WorkerEntrypoint — CF_WORKER binding) ────────────────────

export interface OrionWorkerRpc {
  transcribeAudio(params: {
    userId: string;
    audioBase64: string;
    audioDurationMs?: number;
    messageId?: string;
    chatId?: string;
  }): Promise<{
    text: string;
    vtt?: string;
    words?: Array<{ word: string; start: number; end: number }>;
  }>;

  regenerateProfileSummary(params: { userId: string }): Promise<{
    success: boolean;
    regenerating: boolean;
  }>;

  getCachedSuggestions(params: {
    userId: string;
    agentId: string;
    agentName?: string;
    agentDescription?: string;
  }): Promise<{
    suggestions: Array<{ title: string; description: string; prompt: string; icon: string }>;
    fromCache: boolean;
    regenerating: boolean;
  }>;

  getVisibleAgents(params: { userId: string; cfHeaders?: Record<string, string> }): Promise<{
    agents: Array<{
      id: string;
      name: string;
      description: string | null;
      avatar_url: string | null;
      status: string;
      is_universal: boolean;
      pinnedModelInfo: PinnedModelInfo | null;
    }>;
    shelfAgentIds: string[];
    hasShelf: boolean;
  }>;

  getEnabledFeatures(params: { userId: string }): Promise<{ features: string[] }>;

  getVisibleTemplates(params: { userId: string }): Promise<{
    templates: Array<{
      id: string;
      name: string;
      description: string;
      category: string;
      icon: string;
      default_widgets: unknown;
    }>;
  }>;

  getVisibleWidgets(params: { userId: string }): Promise<{
    widgets: Array<{
      id: string;
      name: string;
      widget_type: string;
      description: string;
      category: string;
      icon: string;
      default_size: string;
      default_config: unknown;
      base_type: string;
    }>;
  }>;

  resolveWidgetData(params: {
    userId: string;
    dataSourceRef: { type: string; source_id: string; params?: Record<string, unknown> };
  }): Promise<{ data: ResolvedData | null }>;

  importFile(params: {
    userId: string;
    fileContent: string;
    mimeType: string;
    fileName: string;
  }): Promise<{
    dataSourceRef: DataSourceRef;
    recordId: string;
    columnCount: number;
    rowCount: number;
  }>;

  getAvailableDataSources(params: { userId: string }): Promise<{
    sources: DataSourceCatalogItem[];
  }>;

  syncModelsFromOpenRouter(): Promise<{
    created: number;
    updated: number;
    deprecated: number;
    pricingUpdated: number;
    toolsAssigned: number;
    skipped: number;
    errors: string[];
  }>;

  getTemplateById(params: { templateId: string }): Promise<{
    template: {
      id: string;
      name: string;
      description: string;
      icon: string;
      category: string;
      default_widgets: unknown;
    } | null;
  }>;

  filterTemplateWidgets(params: {
    userId: string;
    widgets: unknown[];
  }): Promise<{ filteredWidgets: unknown[] }>;

  categorizeNote(args: {
    content: string;
    agentName?: string;
    userId?: string;
    chatId?: string;
  }): Promise<{ category: string; tags: string[] }>;

  getProfilerSchemas(args?: { userId?: string }): Promise<{
    sections: Array<{
      section_id: string;
      label: string;
      icon: string;
      order: number;
      fields: Array<{
        key: string;
        label: string;
        type: 'text' | 'number' | 'date' | 'list';
        description?: string;
      }>;
    }>;
  }>;

  generateProfileSchema(args: {
    systemPrompt: string;
    modelId: string;
  }): Promise<{ success: boolean; schema?: string; error?: string }>;

  generateOnboardingProfileConfig(args: {
    modelId: string;
    system: string;
    context: string;
    user: string;
  }): Promise<{ success: boolean; output?: unknown; error?: string }>;

  validateAndCompileFlow(args: {
    agentId: string;
    flowData: { nodes: unknown[]; edges: unknown[] };
  }): Promise<ValidateAndCompileResult>;

  createCheckoutSession(params: { userId: string; packageId: string }): Promise<{ url: string }>;

  createPortalSession(params: { userId: string }): Promise<{ url: string }>;

  getAvailablePlans(): Promise<unknown[]>;

  debugUserTags(params: { userId: string }): Promise<{
    planData: { id: string; title: string; type: string; granted_tags: unknown } | null;
    userCustomization: { id: string; tags: unknown } | null;
    effectiveTags: string[];
    visibleAgents: Array<{
      id: string;
      name: string;
      tag_rule: TagRule | null;
    }>;
    totalActiveAgents: number;
    diagnostics: string[];
  }>;

  getVisibleAnalyticalTools(params: { userId: string }): Promise<{
    tools: Array<{
      id: string;
      tool_key: string;
      display_name: string;
      description: string;
      category: string;
      icon: string;
      input_schema: unknown;
      output_config: unknown;
    }>;
  }>;

  executeAnalyticalTool(params: {
    userId: string;
    toolKey: string;
    inputParams: Record<string, unknown>;
  }): Promise<{
    success: boolean;
    result?: ToolExecutionResult;
    error?: string;
  }>;

  getToolResults(params: { userId: string; toolKey?: string }): Promise<{
    results: Array<{
      id: string;
      tool_key: string;
      display_name: string;
      created: string;
      data: unknown;
    }>;
  }>;
}

// ── FileServiceRpc (WorkerEntrypoint — FILE_SERVICE binding) ─────────────────

export interface FileServiceRpc {
  uploadFileBuffer(params: {
    fileBuffer: ArrayBuffer;
    fileName: string;
    fileType: string;
    lastModified?: number;
    userId: string;
    chatId?: string;
    shareWithAgent?: boolean;
  }): Promise<UploadResult>;

  uploadSystemFileBuffer(params: {
    fileBuffer: ArrayBuffer;
    fileName: string;
    fileType: string;
    lastModified?: number;
    adminUserId: string;
  }): Promise<UploadResult>;

  uploadFilesBuffer(params: {
    files: Array<{
      buffer: ArrayBuffer;
      fileName: string;
      fileType: string;
      lastModified?: number;
    }>;
    userId: string;
    scope?: UploadScope;
    chatId?: string;
    shareWithAgent?: boolean;
  }): Promise<{ successful: UploadResult[]; failed: Array<{ fileName: string; error: string }> }>;

  deleteFile(params: { fileId: string; userId: string }): Promise<DeleteResult>;

  deleteSystemFile(params: { fileId: string; adminUserId: string }): Promise<DeleteResult>;

  listFiles(params: { userId: string; chatId?: string; page?: number; perPage?: number }): Promise<{
    files: Array<{ id: string; name: string; type: string; size: number; createdAt: string }>;
    totalPages: number;
    totalItems: number;
  }>;

  listSystemFiles(params: { page?: number; perPage?: number; filter?: string }): Promise<{
    files: Array<{ id: string; name: string; type: string; size: number; createdAt: string }>;
    totalPages: number;
    totalItems: number;
  }>;

  getFileStatus(params: { fileId: string; userId: string; scope?: UploadScope }): Promise<{
    id: string;
    name: string;
    type: string;
    size: number;
    status: 'processing' | 'ready' | 'failed';
    vectorIds: string[];
    graphNodeIds: string[];
    createdAt: string;
  } | null>;

  getFileStatuses(params: { fileIds: string[]; userId: string; scope?: UploadScope }): Promise<
    Record<
      string,
      {
        id: string;
        name: string;
        type: string;
        size: number;
        status: 'processing' | 'ready' | 'failed';
      }
    >
  >;

  getDownloadUrl(params: { fileId: string; scope?: UploadScope }): Promise<string | null>;

  getFile(params: { fileId: string; scope?: UploadScope }): Promise<{
    id: string;
    name: string;
    path: string;
    type: string;
    size: number;
    vectors: string[];
    meta: Record<string, unknown>;
    createdAt: string;
  } | null>;
}
