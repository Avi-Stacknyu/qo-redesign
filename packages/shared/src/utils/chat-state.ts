/**
 * Chat State Helpers
 * Pure computation functions for deriving chat UI state.
 * Designed to be used inside Svelte 5 `$derived` blocks.
 *
 * Extracted from apps/web/src/routes/(chat)/chat/[threadId]/+page.svelte
 */

import type { UIMessageLike } from './chat';

// ---------------------------------------------------------------------------
// computeIsThinking
// ---------------------------------------------------------------------------

/**
 * Determines whether the chat should show a "thinking" indicator.
 *
 * Rules:
 * - `submitted` status → always thinking
 * - `streaming` status → thinking unless the last assistant message has
 *   visible content (text or tool parts). After tool outputs are resolved,
 *   re-shows thinking until new text arrives.
 */
export function computeIsThinking(
	status: string,
	messages: UIMessageLike[]
): boolean {
	if (status === 'submitted') return true;

	if (status === 'streaming') {
		const lastMsg = messages[messages.length - 1];
		if (lastMsg?.role === 'assistant') {
			const hasAnsweredToolParts = lastMsg.parts.some(
				(p) =>
					(p.type as string).startsWith('tool-') &&
					'state' in p &&
					(p as Record<string, unknown>).state === 'output-available'
			);

			if (hasAnsweredToolParts) {
				// Find last answered tool part index
				let lastToolIdx = -1;
				for (let i = lastMsg.parts.length - 1; i >= 0; i--) {
					const p = lastMsg.parts[i];
					if (
						(p.type as string).startsWith('tool-') &&
						'state' in p &&
						(p as Record<string, unknown>).state === 'output-available'
					) {
						lastToolIdx = i;
						break;
					}
				}
				// Check if there's new text content after the last answered tool
				const hasNewContent = lastMsg.parts.slice(lastToolIdx + 1).some((p) => {
					if (p.type === 'text' && 'text' in p) {
						return (p as { text: string }).text.trim().length > 0;
					}
					return false;
				});
				return !hasNewContent;
			}

			// No answered tool parts yet — check for any visible content
			const hasVisibleContent = lastMsg.parts.some((p) => {
				if (p.type === 'text' && 'text' in p) {
					return (p as { text: string }).text.trim().length > 0;
				}
				if ((p.type as string).startsWith('tool-')) return true;
				return false;
			});
			return !hasVisibleContent;
		}
	}

	return false;
}

// ---------------------------------------------------------------------------
// computeHasPendingToolCalls
// ---------------------------------------------------------------------------

/**
 * Returns true if the last assistant message has HIL tool parts still
 * awaiting user input (confirmation or input request in `input-available`
 * or `input-streaming` state).
 */
export function computeHasPendingToolCalls(messages: UIMessageLike[]): boolean {
	const lastMsg = messages[messages.length - 1];
	if (!lastMsg || lastMsg.role !== 'assistant') return false;

	return lastMsg.parts.some((part) => {
		const partType = part.type as string;
		if (
			(partType === 'tool-ask_confirmation' || partType === 'tool-request_input') &&
			'state' in part
		) {
			const state = (part as { state: string }).state;
			return state === 'input-available' || state === 'input-streaming';
		}
		return false;
	});
}

// ---------------------------------------------------------------------------
// computeCurrentToolName
// ---------------------------------------------------------------------------

/**
 * Returns the name of the currently active tool (streaming/awaiting input)
 * in the last assistant message, or empty string if none.
 */
export function computeCurrentToolName(
	status: string,
	messages: UIMessageLike[]
): string {
	if (status !== 'streaming') return '';

	const lastMsg = messages[messages.length - 1];
	if (!lastMsg || lastMsg.role !== 'assistant') return '';

	for (const part of lastMsg.parts) {
		const partType = part.type as string;
		if (partType.startsWith('tool-') && partType !== 'tool-result' && 'state' in part) {
			const state = (part as { state: string }).state;
			if (state === 'input-streaming' || state === 'input-available') {
				return partType.slice(5); // strip "tool-" prefix
			}
		}
	}

	return '';
}
