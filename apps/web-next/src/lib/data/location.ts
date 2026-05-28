/**
 * Country and timezone data for location selectors.
 * Countries use ISO 3166-1 alpha-2 codes. Timezones use IANA format.
 */

export const COUNTRIES: Array<{ code: string; name: string }> = [
	{ code: 'US', name: 'United States' },
	{ code: 'GB', name: 'United Kingdom' },
	{ code: 'CA', name: 'Canada' },
	{ code: 'AU', name: 'Australia' },
	{ code: 'DE', name: 'Germany' },
	{ code: 'FR', name: 'France' },
	{ code: 'IN', name: 'India' },
	{ code: 'JP', name: 'Japan' },
	{ code: 'BR', name: 'Brazil' },
	{ code: 'MX', name: 'Mexico' },
	{ code: 'KR', name: 'South Korea' },
	{ code: 'SG', name: 'Singapore' },
	{ code: 'AE', name: 'United Arab Emirates' },
	{ code: 'NL', name: 'Netherlands' },
	{ code: 'CH', name: 'Switzerland' },
	{ code: 'SE', name: 'Sweden' },
	{ code: 'NO', name: 'Norway' },
	{ code: 'DK', name: 'Denmark' },
	{ code: 'FI', name: 'Finland' },
	{ code: 'IE', name: 'Ireland' },
	{ code: 'NZ', name: 'New Zealand' },
	{ code: 'IT', name: 'Italy' },
	{ code: 'ES', name: 'Spain' },
	{ code: 'PT', name: 'Portugal' },
	{ code: 'PL', name: 'Poland' },
	{ code: 'AT', name: 'Austria' },
	{ code: 'BE', name: 'Belgium' },
	{ code: 'IL', name: 'Israel' },
	{ code: 'ZA', name: 'South Africa' },
	{ code: 'HK', name: 'Hong Kong' },
	{ code: 'TW', name: 'Taiwan' },
	{ code: 'CN', name: 'China' },
	{ code: 'ID', name: 'Indonesia' },
	{ code: 'TH', name: 'Thailand' },
	{ code: 'MY', name: 'Malaysia' },
	{ code: 'PH', name: 'Philippines' },
	{ code: 'VN', name: 'Vietnam' },
	{ code: 'AR', name: 'Argentina' },
	{ code: 'CL', name: 'Chile' },
	{ code: 'CO', name: 'Colombia' },
	{ code: 'EG', name: 'Egypt' },
	{ code: 'NG', name: 'Nigeria' },
	{ code: 'KE', name: 'Kenya' },
	{ code: 'SA', name: 'Saudi Arabia' },
	{ code: 'QA', name: 'Qatar' },
	{ code: 'RO', name: 'Romania' },
	{ code: 'CZ', name: 'Czech Republic' },
	{ code: 'HU', name: 'Hungary' },
	{ code: 'GR', name: 'Greece' },
	{ code: 'TR', name: 'Turkey' },
	{ code: 'RU', name: 'Russia' },
	{ code: 'UA', name: 'Ukraine' },
	{ code: 'PK', name: 'Pakistan' },
	{ code: 'BD', name: 'Bangladesh' },
	{ code: 'LK', name: 'Sri Lanka' },
	{ code: 'PE', name: 'Peru' },
	{ code: 'HR', name: 'Croatia' },
	{ code: 'BG', name: 'Bulgaria' },
	{ code: 'RS', name: 'Serbia' },
	{ code: 'SK', name: 'Slovakia' }
];

/** Map of country code → timezone IANA strings */
const TIMEZONES_BY_COUNTRY: Record<string, string[]> = {
	US: [
		'America/New_York',
		'America/Chicago',
		'America/Denver',
		'America/Los_Angeles',
		'America/Phoenix',
		'America/Anchorage',
		'Pacific/Honolulu'
	],
	GB: ['Europe/London'],
	CA: [
		'America/Toronto',
		'America/Vancouver',
		'America/Edmonton',
		'America/Winnipeg',
		'America/Halifax',
		'America/St_Johns'
	],
	AU: [
		'Australia/Sydney',
		'Australia/Melbourne',
		'Australia/Brisbane',
		'Australia/Perth',
		'Australia/Adelaide',
		'Australia/Darwin',
		'Australia/Hobart'
	],
	DE: ['Europe/Berlin'],
	FR: ['Europe/Paris'],
	IN: ['Asia/Kolkata'],
	JP: ['Asia/Tokyo'],
	BR: ['America/Sao_Paulo', 'America/Manaus', 'America/Fortaleza', 'America/Recife'],
	MX: ['America/Mexico_City', 'America/Tijuana', 'America/Cancun', 'America/Monterrey'],
	KR: ['Asia/Seoul'],
	SG: ['Asia/Singapore'],
	AE: ['Asia/Dubai'],
	NL: ['Europe/Amsterdam'],
	CH: ['Europe/Zurich'],
	SE: ['Europe/Stockholm'],
	NO: ['Europe/Oslo'],
	DK: ['Europe/Copenhagen'],
	FI: ['Europe/Helsinki'],
	IE: ['Europe/Dublin'],
	NZ: ['Pacific/Auckland', 'Pacific/Chatham'],
	IT: ['Europe/Rome'],
	ES: ['Europe/Madrid', 'Atlantic/Canary'],
	PT: ['Europe/Lisbon', 'Atlantic/Azores'],
	PL: ['Europe/Warsaw'],
	AT: ['Europe/Vienna'],
	BE: ['Europe/Brussels'],
	IL: ['Asia/Jerusalem'],
	ZA: ['Africa/Johannesburg'],
	HK: ['Asia/Hong_Kong'],
	TW: ['Asia/Taipei'],
	CN: ['Asia/Shanghai'],
	ID: ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'],
	TH: ['Asia/Bangkok'],
	MY: ['Asia/Kuala_Lumpur'],
	PH: ['Asia/Manila'],
	VN: ['Asia/Ho_Chi_Minh'],
	AR: ['America/Argentina/Buenos_Aires'],
	CL: ['America/Santiago'],
	CO: ['America/Bogota'],
	EG: ['Africa/Cairo'],
	NG: ['Africa/Lagos'],
	KE: ['Africa/Nairobi'],
	SA: ['Asia/Riyadh'],
	QA: ['Asia/Qatar'],
	RO: ['Europe/Bucharest'],
	CZ: ['Europe/Prague'],
	HU: ['Europe/Budapest'],
	GR: ['Europe/Athens'],
	TR: ['Europe/Istanbul'],
	RU: ['Europe/Moscow', 'Asia/Yekaterinburg', 'Asia/Novosibirsk', 'Asia/Vladivostok'],
	UA: ['Europe/Kyiv'],
	PK: ['Asia/Karachi'],
	BD: ['Asia/Dhaka'],
	LK: ['Asia/Colombo'],
	PE: ['America/Lima'],
	HR: ['Europe/Zagreb'],
	BG: ['Europe/Sofia'],
	RS: ['Europe/Belgrade'],
	SK: ['Europe/Bratislava']
};

/** Get timezones for a specific country code. Falls back to all timezones if country not found. */
export function getTimezonesForCountry(
	countryCode: string
): Array<{ value: string; label: string }> {
	const zones = TIMEZONES_BY_COUNTRY[countryCode];
	if (!zones) return ALL_TIMEZONES;
	return zones.map((tz) => ({ value: tz, label: formatTimezone(tz) }));
}

/** All timezones flattened (for when no country is selected) */
export const ALL_TIMEZONES: Array<{ value: string; label: string }> = Object.values(
	TIMEZONES_BY_COUNTRY
)
	.flat()
	.filter((tz, i, arr) => arr.indexOf(tz) === i)
	.sort()
	.map((tz) => ({ value: tz, label: formatTimezone(tz) }));

/** Formats "America/New_York" → "New York (America)" */
function formatTimezone(tz: string): string {
	const parts = tz.split('/');
	if (parts.length < 2) return tz;
	const city = parts.slice(-1)[0].replace(/_/g, ' ');
	const region = parts[0];
	return `${city} (${region})`;
}

/** Look up a country name by code */
export function getCountryName(code: string): string {
	return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}
