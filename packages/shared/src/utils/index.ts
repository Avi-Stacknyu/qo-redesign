// @repo/shared — Utilities
// Barrel export for shared utility functions (chat helpers, message conversion, etc.).

// Chat message conversion & formatting
export {
  serverMessagesToUIMessages,
  uiPartsToMessageParts,
  getMessageContent,
  formatToolName,
  formatFileSize
} from './chat';
export type { UIMessageLike, ServerMessage, ConvertedMessages } from './chat';

// Chat UI state computation helpers
export {
  computeIsThinking,
  computeHasPendingToolCalls,
  computeCurrentToolName
} from './chat-state';

// File upload constants
export {
  SUPPORTED_MIME_TYPES,
  SUPPORTED_FILE_EXTENSIONS,
  FILE_INPUT_ACCEPT
} from './file-constants';
export type { SupportedMimeType, SupportedFileExtension } from './file-constants';

// Flow model lock helpers
export { getPinnedModelInfo } from './flow-model-lock';
export type { PinnedModelInfo } from './flow-model-lock';

// Profiler field canonicalization helpers
export {
  PROFILE_FIELD_ALIASES,
  canonicalizeProfileUpdates,
  findProfileField,
  sameProfileField,
  schemaKeyFor
} from './profiler-fields';
export type { ProfileSections } from './profiler-fields';
