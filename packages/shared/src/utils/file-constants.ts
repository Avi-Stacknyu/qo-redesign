/**
 * File Upload Constants
 * Supported MIME types and file extensions for chat file uploads.
 *
 * Extracted from apps/web/src/lib/components/chat/ChatInput.svelte
 */

export const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/html',
  'application/json',
  'application/xml',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/svg+xml',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.text'
] as const;

export const SUPPORTED_FILE_EXTENSIONS = [
  '.pdf',
  '.txt',
  '.md',
  '.csv',
  '.html',
  '.json',
  '.xml',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.svg',
  '.xlsx',
  '.xls',
  '.docx',
  '.ods',
  '.odt'
] as const;

/** Accept string for file input elements */
export const FILE_INPUT_ACCEPT = [...SUPPORTED_MIME_TYPES, ...SUPPORTED_FILE_EXTENSIONS].join(',');

export type SupportedMimeType = (typeof SUPPORTED_MIME_TYPES)[number];
export type SupportedFileExtension = (typeof SUPPORTED_FILE_EXTENSIONS)[number];
