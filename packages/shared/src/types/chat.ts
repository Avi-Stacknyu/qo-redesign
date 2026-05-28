/**
 * Shared Chat Types
 * Types duplicated inline across both apps, unified here.
 */

/**
 * Client-side file attachment metadata.
 * Represents a file attached to a chat message (user uploads).
 */
export interface ChatFileAttachment {
	id: string;
	name: string;
	size: number;
	type: string;
	url: string;
	uploaded_at?: string;
}

/**
 * Data received from the stream 'done' event.
 * Contains PB record IDs and cost data from the completed stream.
 */
export interface DoneEventData {
	sessionId?: string;
	cost?: Record<string, unknown>;
	userMessageId?: string;
	assistantMessageId?: string;
}
