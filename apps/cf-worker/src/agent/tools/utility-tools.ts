import { z } from 'zod';
import { tool } from 'ai';
import type { ToolContext } from './types';

// ============================================================================
// Safe math expression evaluator (recursive descent parser)
// Supports: numbers, +, -, *, /, %, parentheses, function calls, constants.
// No eval() or new Function() — compatible with Cloudflare Workers runtime.
// ============================================================================

const MATH_FNS: Record<string, (...args: number[]) => number> = {
	sqrt: Math.sqrt,
	abs: Math.abs,
	round: Math.round,
	floor: Math.floor,
	ceil: Math.ceil,
	pow: Math.pow,
	min: (...args: number[]) => Math.min(...args),
	max: (...args: number[]) => Math.max(...args),
	sin: Math.sin,
	cos: Math.cos,
	tan: Math.tan,
	log: Math.log,
	log10: Math.log10,
	exp: Math.exp
};

const CONSTANTS: Record<string, number> = { PI: Math.PI, E: Math.E };

function evaluateMathExpression(expr: string): number {
	let pos = 0;
	const src = expr.replace(/\s+/g, '');

	function peek(): string {
		return src[pos] ?? '';
	}
	function consume(ch?: string): string {
		if (ch && src[pos] !== ch) throw new Error(`Expected '${ch}'`);
		return src[pos++];
	}

	// expr = term (('+' | '-') term)*
	function parseExpr(): number {
		let val = parseTerm();
		while (peek() === '+' || peek() === '-') {
			const op = consume();
			const right = parseTerm();
			val = op === '+' ? val + right : val - right;
		}
		return val;
	}

	// term = unary (('*' | '/' | '%') unary)*
	function parseTerm(): number {
		let val = parseUnary();
		while (peek() === '*' || peek() === '/' || peek() === '%') {
			const op = consume();
			const right = parseUnary();
			if (op === '*') val *= right;
			else if (op === '/') val /= right;
			else val %= right;
		}
		return val;
	}

	// unary = '-' unary | call
	function parseUnary(): number {
		if (peek() === '-') {
			consume('-');
			return -parseUnary();
		}
		return parseCall();
	}

	// call = IDENT '(' args ')' | primary
	function parseCall(): number {
		const start = pos;
		if (/[a-zA-Z]/.test(peek())) {
			let name = '';
			while (/[a-zA-Z0-9_]/.test(peek())) name += consume();

			if (peek() === '(') {
				// Function call
				const fn = MATH_FNS[name];
				if (!fn) throw new Error(`Unknown function: ${name}`);
				consume('(');
				const args: number[] = [];
				if (peek() !== ')') {
					args.push(parseExpr());
					while (peek() === ',') {
						consume(',');
						args.push(parseExpr());
					}
				}
				consume(')');
				return fn(...args);
			}

			// Constant
			if (name in CONSTANTS) return CONSTANTS[name];
			throw new Error(`Unknown identifier: ${name}`);
		}
		// Reset if not an identifier
		pos = start;
		return parsePrimary();
	}

	// primary = NUMBER | '(' expr ')'
	function parsePrimary(): number {
		if (peek() === '(') {
			consume('(');
			const val = parseExpr();
			consume(')');
			return val;
		}
		// Number
		let numStr = '';
		while (/[0-9.]/.test(peek())) numStr += consume();
		if (!numStr) throw new Error(`Unexpected character: '${peek()}'`);
		return parseFloat(numStr);
	}

	const result = parseExpr();
	if (pos < src.length) throw new Error(`Unexpected character at position ${pos}: '${src[pos]}'`);
	return result;
}

export function createUtilityTools(ctx: ToolContext) {
	return {
		get_current_time: tool({
			description: "Get the current date and time in the user's timezone.",
			inputSchema: z.object({}),
			execute: async () => {
				const now = new Date();
				const tz = ctx.timezone ?? 'UTC';
				return {
					iso: now.toISOString(),
					local: now.toLocaleString('en-US', { timeZone: tz }),
					timezone: tz,
					date: now.toLocaleDateString('en-US', { timeZone: tz }),
					time: now.toLocaleTimeString('en-US', { timeZone: tz })
				};
			}
		}),

		calculate: tool({
			description:
				'Perform a mathematical calculation. Supports basic arithmetic and common math functions.',
			inputSchema: z.object({
				expression: z
					.string()
					.describe(
						'The mathematical expression to evaluate (e.g., "2 + 2", "sqrt(16)", "100 * 0.15")'
					)
			}),
			execute: async ({ expression }: { expression: string }) => {
				try {
					const result = evaluateMathExpression(expression);
					if (typeof result !== 'number' || !Number.isFinite(result)) {
						return { error: `Expression did not evaluate to a finite number: ${expression}` };
					}
					return { expression, result, formatted: `${expression} = ${result}` };
				} catch {
					return { error: `Could not evaluate: ${expression}` };
				}
			}
		})
	};
}
