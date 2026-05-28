import { describe, expect, it } from 'vitest';
import { getSignInErrorMessage } from './auth-error-message';

describe('getSignInErrorMessage', () => {
	it('returns email verification guidance for EMAIL_NOT_VERIFIED', () => {
		expect(getSignInErrorMessage(403, { code: 'EMAIL_NOT_VERIFIED' })).toBe(
			'Please verify your email before signing in. Check your inbox for a verification link.'
		);
	});

	it('returns rate-limit guidance for 429 responses', () => {
		expect(getSignInErrorMessage(429, { code: 'RATE_LIMITED' })).toBe(
			'Too many sign-in attempts. Please wait a moment and try again.'
		);
	});

	it('falls back to the generic invalid-credentials message', () => {
		expect(getSignInErrorMessage(401, { code: 'INVALID_EMAIL_OR_PASSWORD' })).toBe(
			'Invalid email or password. Please try again.'
		);
	});

	it('preserves useful client errors when Better Auth returns one', () => {
		expect(getSignInErrorMessage(400, { message: 'Password must be at least 8 characters.' })).toBe(
			'Password must be at least 8 characters.'
		);
	});
});
