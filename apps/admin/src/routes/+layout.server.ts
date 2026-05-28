export const ssr = true;

import type { ThemeMode } from '$lib/components/theme-handler/types';
import { userCustomization } from '@repo/db/schema';
import { eq, and } from 'drizzle-orm';
import { loadFlash } from 'sveltekit-flash-message/server';

interface ThemePreferenceValue {
	preset: string;
	currentMode: ThemeMode;
}

function sanitizeThemePreference(value: unknown): ThemePreferenceValue | null {
	if (!value || typeof value !== 'object') {
		return null;
	}

	const rawPreset = Reflect.get(value, 'preset');
	const preset = typeof rawPreset === 'string' ? rawPreset.trim() : '';
	if (!preset) {
		return null;
	}

	const rawMode = Reflect.get(value, 'currentMode');
	const currentMode: ThemeMode = rawMode === 'dark' ? 'dark' : 'light';

	return {
		preset,
		currentMode
	};
}

export const load = loadFlash(async ({ locals: { user, db, maintenanceMode }, cookies }) => {
	let themePreference: ThemePreferenceValue | null = null;
	let themeCustomizationRecordId: string | null = null;

	if (db && user) {
		try {
			const [record] = await db
				.select()
				.from(userCustomization)
				.where(and(eq(userCustomization.user, user.id), eq(userCustomization.key, 'theme')))
				.limit(1);

			if (record) {
				const sanitized = sanitizeThemePreference(record.value);
				if (sanitized) {
					themePreference = sanitized;
					themeCustomizationRecordId = record.id;
				}
			}
		} catch (err) {
			console.error('Failed to load theme preference', err);
		}
	}

	return {
		user,
		themePreference,
		themeCustomizationRecordId,
		maintenanceMode: maintenanceMode ?? false
	};
});
