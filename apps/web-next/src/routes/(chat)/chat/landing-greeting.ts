export function getGreetingPrefix(now: Date): string {
	const hour = now.getHours();

	if (hour >= 5 && hour < 12) return 'Good morning';
	if (hour >= 12 && hour < 17) return 'Good afternoon';
	if (hour >= 17 && hour < 22) return 'Good evening';
	return 'Hello';
}

export function getGreetingText(now: Date, name?: string | null): string {
	const firstName = name?.trim().split(/\s+/)[0];
	return `${getGreetingPrefix(now)}, ${firstName || 'there'}`;
}