import { describe, expect, it } from 'vitest';
import { extractCampaignHint } from './onboarding-source-cookie';

describe('extractCampaignHint', () => {
	it('reads a campaign hint from the request URL', () => {
		const url = new URL('https://example.test/register?campaign=school-west');
		expect(extractCampaignHint(url)).toEqual({ campaignSlug: 'school-west' });
	});

	it('returns empty when no campaign param exists', () => {
		const url = new URL('https://example.test/register');
		expect(extractCampaignHint(url)).toEqual({});
	});

	it('trims whitespace from campaign slug', () => {
		const url = new URL('https://example.test/register?campaign=  medical-clinic  ');
		expect(extractCampaignHint(url)).toEqual({ campaignSlug: 'medical-clinic' });
	});

	it('reads an invite code from the request URL', () => {
		const url = new URL('https://example.test/register?invite=  ADVISORY-2026  ');
		expect(extractCampaignHint(url)).toEqual({ inviteCode: 'ADVISORY-2026' });
	});
});
