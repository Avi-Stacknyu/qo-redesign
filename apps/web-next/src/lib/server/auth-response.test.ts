import { describe, expect, it } from 'vitest';
import { getSafeCallbackPath } from './auth-response';

describe('getSafeCallbackPath', () => {
	it('accepts safe relative callbacks', () => {
		expect(getSafeCallbackPath('/dashboard?from=verify', 'https://app.example.com')).toBe(
			'/dashboard?from=verify'
		);
	});

	it('accepts same-origin absolute callbacks', () => {
		expect(
			getSafeCallbackPath('https://app.example.com/preferences/billing', 'https://app.example.com')
		).toBe('/preferences/billing');
	});

	it('rejects external callbacks', () => {
		expect(getSafeCallbackPath('https://evil.example.com/phish', 'https://app.example.com')).toBe(
			null
		);
	});

	it('rejects protocol-relative callbacks', () => {
		expect(getSafeCallbackPath('//evil.example.com/phish', 'https://app.example.com')).toBe(null);
	});
});
