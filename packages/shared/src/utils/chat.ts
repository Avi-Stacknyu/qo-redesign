/**
 * Chat Utilities
 * Message conversion, formatting, and helper functions for chat.
 *
 * Extracted from apps/web/src/routes/(chat)/chat/[threadId]/+page.svelte
 */

import type {
  MessagePart,
  ToolPartState,
  ShadcnChartOutput,
  TableOutput,
  ConfirmationInput,
  ConfirmationToolOutput,
  InputRequestInput,
  InputRequestToolOutput,
  DashboardUpdateOutput
} from '../types/generative-ui';
import { DASHBOARD_TOOL_NAMES } from '../types/generative-ui';
import type { ChatFileAttachment } from '../types/chat';

// ---------------------------------------------------------------------------
// Types used by the converter (minimal AI SDK interop — no hard dep on ai pkg)
// ---------------------------------------------------------------------------

/** Minimal shape of AI SDK UIMessage — avoids importing the full ai package. */
export interface UIMessageLike {
  id: string;
  role: 'user' | 'assistant';
  parts: Array<Record<string, unknown>>;
  metadata?: Record<string, unknown>;
}

/** Raw server message shape as returned from the chat_messages table. */
export interface ServerMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
  files?: ChatFileAttachment[];
  parts?: unknown[];
}

/** Result of converting server messages — pure, no side effects. */
export interface ConvertedMessages {
  messages: UIMessageLike[];
  /** Map of messageId → attached files (extracted from server messages). */
  fileMap: Map<string, ChatFileAttachment[]>;
}

// ---------------------------------------------------------------------------
// serverMessagesToUIMessages
// ---------------------------------------------------------------------------

/**
 * Converts `chat_messages` records into AI SDK-compatible UIMessage
 * objects with parts reconstruction and expired state detection for HIL tools.
 *
 * Returns both the converted messages and a file map (side-effect free).
 */
export function serverMessagesToUIMessages(messages: ServerMessage[]): ConvertedMessages {
  const fileMap = new Map<string, ChatFileAttachment[]>();

  const converted = messages.map((msg) => {
    const uiParts: Array<Record<string, unknown>> = [];
    const content = msg.content || '';

    let partsHaveText = false;
    if (msg.parts?.length) {
      for (const part of msg.parts as Array<Record<string, unknown>>) {
        if (part.type === 'text' && typeof part.text === 'string') {
          partsHaveText = true;
          uiParts.push({ type: 'text', text: part.text });
        } else if (typeof part.type === 'string' && (part.type as string).startsWith('tool-')) {
          let partState =
            (part.state as string) || (part.output ? 'output-available' : 'input-available');

          // Mark unanswered HIL tool parts as expired (loaded from history)
          const isHilTool =
            part.type === 'tool-ask_confirmation' || part.type === 'tool-request_input';
          if (isHilTool && partState === 'input-available' && !part.output) {
            partState = 'expired';
          }

          uiParts.push({
            type: part.type as string,
            toolCallId: (part.toolCallId as string) ?? '',
            state: partState,
            input: part.input ?? {},
            output: part.output ?? undefined
          });
        }
      }
    }

    if (content && !partsHaveText) {
      uiParts.push({ type: 'text', text: content });
    }

    if (msg.files?.length) {
      fileMap.set(msg.id, msg.files);
    }

    return {
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      parts: uiParts.length > 0 ? uiParts : [{ type: 'text' as const, text: '' }],
      metadata: {
        createdAt: msg.created_at
      }
    } as UIMessageLike;
  });

  return { messages: converted, fileMap };
}

// ---------------------------------------------------------------------------
// uiPartsToMessageParts
// ---------------------------------------------------------------------------

/**
 * Converts AI SDK UIMessage.parts into shared MessagePart[] for gen-UI renderers.
 * Returns undefined if there are no tool parts (text-only messages don't need
 * the gen-UI renderer pipeline).
 */
export function uiPartsToMessageParts(
  parts: Array<Record<string, unknown>>
): MessagePart[] | undefined {
  const result: MessagePart[] = [];

  for (const part of parts) {
    if (part.type === 'text') {
      result.push({ type: 'text', text: part.text as string });
    } else {
      const partType = part.type as string;
      if (partType.startsWith('tool-') && 'state' in part && 'toolCallId' in part) {
        const toolPart = part as {
          type: string;
          toolCallId: string;
          state: string;
          output?: unknown;
          input?: unknown;
          errorText?: string;
        };

        if (partType === 'tool-display_chart') {
          result.push({
            type: 'tool-display_chart',
            state: toolPart.state as ToolPartState,
            toolCallId: toolPart.toolCallId,
            output: toolPart.output as ShadcnChartOutput | undefined,
            errorText: toolPart.errorText
          });
        } else if (partType === 'tool-display_table') {
          result.push({
            type: 'tool-display_table',
            state: toolPart.state as ToolPartState,
            toolCallId: toolPart.toolCallId,
            output: toolPart.output as TableOutput | undefined,
            errorText: toolPart.errorText
          });
        } else if (partType === 'tool-ask_confirmation') {
          result.push({
            type: 'tool-ask_confirmation',
            state: toolPart.state as ToolPartState,
            toolCallId: toolPart.toolCallId,
            input: toolPart.input as ConfirmationInput | undefined,
            output: toolPart.output as ConfirmationToolOutput | undefined,
            errorText: toolPart.errorText
          });
        } else if (partType === 'tool-request_input') {
          result.push({
            type: 'tool-request_input',
            state: toolPart.state as ToolPartState,
            toolCallId: toolPart.toolCallId,
            input: toolPart.input as InputRequestInput | undefined,
            output: toolPart.output as InputRequestToolOutput | undefined,
            errorText: toolPart.errorText
          });
        } else {
          // Check if this is a dashboard tool by extracting toolName from 'tool-{name}'
          const toolName = partType.slice(5); // remove 'tool-' prefix
          if (DASHBOARD_TOOL_NAMES.has(toolName)) {
            result.push({
              type: 'tool-dashboard_update',
              state: toolPart.state as ToolPartState,
              toolCallId: toolPart.toolCallId,
              output: toolPart.output as DashboardUpdateOutput | undefined,
              errorText: toolPart.errorText
            });
          }
        }
      }
    }
  }

  const hasToolParts = result.some((p) => p.type !== 'text');
  return hasToolParts || result.length > 1 ? result : undefined;
}

// ---------------------------------------------------------------------------
// getMessageContent
// ---------------------------------------------------------------------------

/**
 * Extracts the concatenated text content from a UIMessage's parts.
 */
export function getMessageContent(msg: UIMessageLike): string {
  return msg.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

// ---------------------------------------------------------------------------
// formatToolName
// ---------------------------------------------------------------------------

/**
 * Converts a snake_case tool name into a display-friendly title.
 * e.g. "web_search" → "Web Search"
 */
export function formatToolName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// ---------------------------------------------------------------------------
// formatFileSize
// ---------------------------------------------------------------------------

/**
 * Formats a byte count into a human-readable string (B, KB, MB).
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
