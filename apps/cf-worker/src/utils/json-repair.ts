/**
 * Safe JSON parsing for LLM output.
 *
 * LLMs sometimes produce truncated JSON when hitting token limits.
 * This utility attempts basic repair (closing brackets/braces,
 * stripping trailing incomplete elements) before giving up.
 */

/**
 * Attempt to parse JSON that may be truncated by an LLM token limit.
 * Returns `null` when the string is unrecoverable.
 */
export function safeParseLLMJson<T>(raw: string): T | null {
	// 1. Try parsing as-is first (fast path)
	try {
		return JSON.parse(raw) as T;
	} catch {
		// fall through to repair
	}

	// 2. Attempt lightweight repair
	try {
		const repaired = repairTruncatedJson(raw);
		return JSON.parse(repaired) as T;
	} catch {
		return null;
	}
}

/**
 * Best-effort repair of truncated JSON produced by LLMs.
 *
 * Strategy:
 *  - Strip a trailing incomplete value (e.g. a string missing its closing quote,
 *    or a partial number/keyword).
 *  - Remove dangling commas.
 *  - Close any unclosed `[` / `{` in the correct order.
 */
function repairTruncatedJson(raw: string): string {
	let s = raw;

	// Strip trailing whitespace
	s = s.trimEnd();

	// If the string ends mid-string-literal, remove back to the last unescaped quote
	if (endsInsideString(s)) {
		const lastQuote = findLastUnescapedQuote(s);
		if (lastQuote > 0) {
			// Remove from the incomplete string value onward
			s = s.slice(0, lastQuote);
		}
	}

	// Remove any trailing partial token (incomplete key, number, bool, null)
	s = s.replace(/,\s*"[^"]*$/, ''); // trailing incomplete key like ,"partialK
	s = s.replace(/:\s*"[^"]*$/, ''); // trailing incomplete string value like :"partialV
	s = s.replace(/:\s*[-\d.eE+]+$/, ''); // trailing incomplete number
	s = s.replace(/:\s*(?:tru?|fals?|nul?)$/i, ''); // trailing incomplete keyword

	// Remove dangling commas before we close brackets
	s = s.replace(/,\s*$/, '');

	// Count unclosed openers and close them in reverse order
	const stack: string[] = [];
	let inStr = false;
	let escape = false;

	for (let i = 0; i < s.length; i++) {
		const c = s[i];
		if (escape) {
			escape = false;
			continue;
		}
		if (c === '\\' && inStr) {
			escape = true;
			continue;
		}
		if (c === '"') {
			inStr = !inStr;
			continue;
		}
		if (inStr) continue;

		if (c === '{' || c === '[') {
			stack.push(c === '{' ? '}' : ']');
		} else if (c === '}' || c === ']') {
			if (stack.length > 0 && stack[stack.length - 1] === c) {
				stack.pop();
			}
		}
	}

	// If we're still inside a string after scanning, close the quote
	if (inStr) {
		s += '"';
	}

	// Remove dangling commas again (may have been exposed by string close)
	s = s.replace(/,\s*([}\]])/, '$1');

	// Close unclosed brackets/braces in LIFO order
	while (stack.length > 0) {
		s += stack.pop();
	}

	return s;
}

/** Check if the string ends inside an unclosed JSON string literal. */
function endsInsideString(s: string): boolean {
	let inStr = false;
	let escape = false;
	for (let i = 0; i < s.length; i++) {
		const c = s[i];
		if (escape) {
			escape = false;
			continue;
		}
		if (c === '\\' && inStr) {
			escape = true;
			continue;
		}
		if (c === '"') {
			inStr = !inStr;
		}
	}
	return inStr;
}

/** Find the index of the last unescaped `"` in the string. */
function findLastUnescapedQuote(s: string): number {
	for (let i = s.length - 1; i >= 0; i--) {
		if (s[i] === '"') {
			// Count preceding backslashes
			let backslashes = 0;
			for (let j = i - 1; j >= 0 && s[j] === '\\'; j--) {
				backslashes++;
			}
			if (backslashes % 2 === 0) return i;
		}
	}
	return -1;
}
