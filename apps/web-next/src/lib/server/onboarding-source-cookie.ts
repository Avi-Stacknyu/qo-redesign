import { dev } from '$app/environment';
import type { RequestEvent } from '@sveltejs/kit';

const COOKIE_NAME = 'qo-onboarding-source';
const COOKIE_MAX_AGE = 60 * 60; // 1 hour

export interface OnboardingSourceHint {
	campaignSlug?: string;
	inviteCode?: string;
}

export function extractCampaignHint(url: URL): OnboardingSourceHint {
	const campaignSlug = url.searchParams.get('campaign')?.trim();
	const inviteCode =
		url.searchParams.get('invite')?.trim() ?? url.searchParams.get('code')?.trim() ?? '';
	return {
		...(campaignSlug ? { campaignSlug } : {}),
		...(inviteCode ? { inviteCode } : {})
	};
}

export function writeCampaignHintCookie(event: RequestEvent, hint: OnboardingSourceHint) {
	if (!hint.campaignSlug && !hint.inviteCode) return;
	event.cookies.set(
		COOKIE_NAME,
		JSON.stringify({ ...hint, capturedAt: new Date().toISOString() }),
		{
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: !dev,
			maxAge: COOKIE_MAX_AGE
		}
	);
}

export function readCampaignHintCookie(event: RequestEvent): OnboardingSourceHint | null {
	const raw = event.cookies.get(COOKIE_NAME);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as OnboardingSourceHint;
	} catch {
		return null;
	}
}

export function clearCampaignHintCookie(event: RequestEvent) {
	event.cookies.delete(COOKIE_NAME, { path: '/' });
}
