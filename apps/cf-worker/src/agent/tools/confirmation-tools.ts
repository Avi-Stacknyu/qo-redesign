import { z } from 'zod';
import { tool } from 'ai';
import type { ToolContext } from './types';

export function createConfirmationTools(_ctx: ToolContext) {
	return {
		/**
		 * Ask user for confirmation before performing an action.
		 * HUMAN-IN-THE-LOOP: No execute function — the tool call is forwarded to the
		 * client where the frontend renders a confirmation dialog. The user's response
		 * is sent back via `addToolOutput()` on the Chat class, which feeds the result
		 * back as a proper tool result (not a new user message).
		 */
		ask_confirmation: tool({
			description: `Ask the user for confirmation before performing a sensitive or irreversible action.
Use this for actions like:
- Saving notes or bookmarking conversation insights
- Deleting data
- Sending emails/messages
- Making purchases or financial transactions
- Modifying important settings
- Any action that cannot be easily undone

The user will see a confirmation dialog with Yes/No buttons.
Wait for the user's response before proceeding with the action.`,
			inputSchema: z.object({
				message: z
					.string()
					.describe('The confirmation message to show the user (e.g., "Delete all notes?")'),
				action_description: z
					.string()
					.describe(
						'Brief description of what will happen if confirmed (e.g., "This will permanently delete 5 notes")'
					),
				severity: z
					.enum(['info', 'warning', 'danger'])
					.optional()
					.default('warning')
					.describe('Severity level affects the dialog styling')
			}),
			outputSchema: z.object({
				confirmed: z.boolean().describe('Whether the user confirmed the action'),
				message: z.string().describe('The original confirmation message')
			})
			// No execute — forwarded to client for human-in-the-loop interaction
		}),

		/**
		 * Request user input for a specific value.
		 * HUMAN-IN-THE-LOOP: No execute function — the tool call is forwarded to the
		 * client where the frontend renders an input form. The user's submission is
		 * sent back via `addToolOutput()` on the Chat class.
		 */
		request_input: tool({
			description: `Request additional input from the user when you need specific information to proceed.
Use this when:
- You need a specific value the user hasn't provided
- Clarification is needed
- User needs to make a choice between options
- User needs to pick from a short list of choices (use button_select for 2-6 options)

Input types:
- text: Free-form text input
- number: Numeric input
- date: Date picker
- select: Dropdown select (for longer option lists)
- button_select: Inline clickable buttons (best for 2-6 short options, like multiple choice)

The user will see an input field, dropdown, or button grid depending on input_type.`,
			inputSchema: z.object({
				prompt: z.string().describe('The prompt/question to show the user'),
				input_type: z
					.enum(['text', 'number', 'date', 'select', 'button_select'])
					.optional()
					.default('text')
					.describe(
						'Type of input to request. Use button_select for 2-6 short choices displayed as clickable buttons.'
					),
				options: z
					.array(z.string())
					.optional()
					.describe(
						'Options for select or button_select type input. Required when input_type is select or button_select.'
					),
				placeholder: z.string().optional().describe('Placeholder text for the input field'),
				required: z.boolean().optional().default(true).describe('Whether input is required')
			}),
			outputSchema: z.object({
				value: z.string().describe('The value entered/selected by the user')
			})
			// No execute — forwarded to client for human-in-the-loop interaction
		})
	};
}
