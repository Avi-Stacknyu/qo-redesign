const DEFAULT_SIGN_IN_ERROR = 'Invalid email or password. Please try again.';

type AuthErrorBody = {
	code?: unknown;
	message?: unknown;
};

export function getSignInErrorMessage(
	status: number,
	body: AuthErrorBody | null | undefined
): string {
	const code = typeof body?.code === 'string' ? body.code : null;
	const message = typeof body?.message === 'string' ? body.message : null;

	if (code === 'EMAIL_NOT_VERIFIED') {
		return 'Please verify your email before signing in. Check your inbox for a verification link.';
	}

	if (status === 429) {
		return 'Too many sign-in attempts. Please wait a moment and try again.';
	}

	if (code === 'INVALID_EMAIL_OR_PASSWORD') {
		return DEFAULT_SIGN_IN_ERROR;
	}

	if (message && message.trim().length > 0 && status >= 400 && status < 500) {
		return message;
	}

	return DEFAULT_SIGN_IN_ERROR;
}
