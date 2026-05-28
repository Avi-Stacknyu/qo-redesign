/**
 * Widget Data Resolver Types
 *
 * A universal system for resolving widget data from multiple source types.
 * Widgets reference data via DataSourceRef; the worker resolves to ResolvedData at runtime.
 */

/** Supported data source types. */
export type DataSourceType =
  | 'static'
  | 'agent-generated'
  | 'user-upload'
  | 'analytical-tool'
  | 'external';

/** Who created a user_data_sources record. */
export type DataSourceCreatedBy = 'agent' | 'tool' | 'upload' | 'user' | 'system';

/** Catalog entry returned by getAvailableDataSources — describes one selectable data source. */
export interface DataSourceCatalogItem {
  source_id: string;
  type: DataSourceType;
  label: string;
  description?: string;
  created_by?: DataSourceCreatedBy;
  updated_at?: string;
}

/**
 * A reference to a data source. Stored in widget custom_config or template default_widgets.
 * The worker resolves this at runtime to produce ResolvedData.
 */
export interface DataSourceRef {
  type: DataSourceType;
  /** Unique key (for admin-managed sources) or PB record ID (for user-owned sources). */
  source_id: string;
  /** Optional parameters: filters, date ranges, account IDs, etc. */
  params?: Record<string, unknown>;
}

/** Column definition in resolved data. */
export interface ResolvedColumn {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date';
}

/** Normalized tabular data that any widget can render. */
export interface ResolvedData {
  columns: ResolvedColumn[];
  rows: Record<string, unknown>[];
  meta?: {
    title?: string;
    updated_at?: string;
    source_label?: string;
    available_data_keys?: string[];
  };
}

/** Extended TemplateWidget with new fields for visual config, tag gating, and data source. */
export interface TemplateWidget {
  widget_type: string;
  widget_title: string;
  position: { order: number; size: 'sm' | 'md' | 'lg' };
  custom_config?: Record<string, unknown>;
  visual_config?: { bg?: string; border?: string; accent?: string; tint?: string } | null;
  tag_rule?: import('./tag-rules').TagRule | null;
  data_source?: DataSourceRef | null;
}
