import type { Cookies } from '@sveltejs/kit';

type CookieOptions = NonNullable<Parameters<Cookies['set']>[2]>;

export function forwardAuthCookiesFromResponse(response: Response, cookies: Cookies): void {
	for (const raw of response.headers.getSetCookie()) {
		const parts = raw.split(';');
		const [head, ...attrs] = parts;
		const eqIdx = head.indexOf('=');
		if (eqIdx < 0) continue;

		const name = head.slice(0, eqIdx).trim();
		const value = head.slice(eqIdx + 1).trim();
		const opts: CookieOptions = { path: '/' };

		for (const attr of attrs) {
			const token = attr.trim();
			const lower = token.toLowerCase();
			if (lower === 'httponly') opts.httpOnly = true;
			else if (lower === 'secure') opts.secure = true;
			else if (lower.startsWith('max-age=')) opts.maxAge = parseInt(lower.split('=')[1]);
			else if (lower.startsWith('samesite=')) {
				const sameSite = token.split('=')[1].toLowerCase();
				if (sameSite === 'lax' || sameSite === 'strict' || sameSite === 'none') {
					opts.sameSite = sameSite;
				}
			} else if (lower.startsWith('path=')) {
				opts.path = token.split('=')[1];
			}
		}

		cookies.set(name, decodeURIComponent(value), opts);
	}
}

export function getSafeCallbackPath(
	callbackURL: string | null,
	currentOrigin: string
): string | null {
	if (!callbackURL) return null;
	if (callbackURL.startsWith('/') && !callbackURL.startsWith('//')) return callbackURL;

	try {
		const parsed = new URL(callbackURL);
		if (parsed.origin !== currentOrigin) return null;
		return `${parsed.pathname}${parsed.search}${parsed.hash}`;
	} catch {
		return null;
	}
}
