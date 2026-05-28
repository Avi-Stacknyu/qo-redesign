/**
 * Shared widget configuration types — type definitions only.
 * Config field descriptors and widget metadata are now DB-driven,
 * stored as `config_fields` JSON on each `dashboard_widgets` record.
 *
 * Admin uses these types to render config editors for catalog widgets/templates.
 * Web uses these types to render per-instance settings for user widget instances.
 */

// ── Widget Type Registry ─────────────────────────────────────────────────────

export type WidgetType =
  | 'chart'
  | 'todo'
  | 'news'
  | 'reminders'
  | 'quick-actions'
  | 'recent-chats'
  | 'calendar'
  | 'bookmarks'
  | 'profile-summary'
  | 'knowledge'
  | 'bank-accounts';

export type WidgetSize = 'sm' | 'md' | 'lg';

// ── Config Field Descriptors ─────────────────────────────────────────────────

export type ConfigFieldType = 'select' | 'number' | 'text' | 'toggle' | 'tags';

export interface ConfigFieldDescriptor {
  key: string;
  label: string;
  type: ConfigFieldType;
  options?: { value: string; label: string }[];
  /** Dynamic source — resolved at runtime by the frontend. Admin skips these fields. */
  source?: 'categories' | 'dataSources';
  defaultValue?: unknown;
  min?: number;
  max?: number;
  placeholder?: string;
}

// ── Widget Display Metadata ──────────────────────────────────────────────────

export interface WidgetMeta {
  type: WidgetType;
  label: string;
  description: string;
  icon: string;
  defaultSize: WidgetSize;
}
