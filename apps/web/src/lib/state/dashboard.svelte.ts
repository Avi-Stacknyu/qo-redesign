/**
 * Unified dashboard store — single source of truth for all client-side state.
 *
 * Owns: profiles, active profile, layout, widgets, theme, edit mode.
 * All mutations are local-first (instant UI) with background server persistence.
 *
 * Profile switching is fully client-cached:
 *   1. On hydration, the active profile's data is cached locally.
 *   2. All other profiles are prefetched in the background.
 *   3. switchProfile() reads from cache — instant, zero server round-trips.
 *   4. The is_active flag is synced to the server in the background.
 *
 * Hydration:
 *   +layout.svelte  → dashboard.hydrateProfiles()  (profiles + activeProfile)
 *   +page.svelte    → dashboard.hydrateWidgets()    (layout + widgets)
 */

import {
	addWidget as addWidgetCmd,
	removeWidget as removeWidgetCmd,
	updateWidget as updateWidgetCmd,
	saveLayout as saveLayoutCmd,
	loadProfileDashboard
} from '$lib/remote/dashboard.remote';
import {
	switchProfile as switchProfileCmd,
	updateProfile as updateProfileCmd,
	createProfile as createProfileCmd,
	duplicateProfile as duplicateProfileCmd,
	deleteProfile as deleteProfileCmd
} from '$lib/remote/profile.remote';
import { untrack } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';
import { THEME_PRESETS } from '$lib/theme-presets';
import type { ThemeMode } from '$lib/types/theme';
import type {
	UserProfileRecord,
	UserDashboardLayoutRecord,
	UserWidgetInstanceRecord,
	WidgetSize,
	WidgetPosition
} from '$lib/types/widgets';

// ── State ────────────────────────────────────────────────────────────────────

let profiles = $state<UserProfileRecord[]>([]);
let activeProfileId = $state<string | null>(null);
let layout = $state<UserDashboardLayoutRecord | null>(null);
let widgets = $state<UserWidgetInstanceRecord[]>([]);
let editMode = $state(false);
let switching = $state(false);
let saving = $state(false);
let pendingPositions = $state<{ widgetId: string; position: WidgetPosition }[] | null>(null);

// ── Profile Data Cache ───────────────────────────────────────────────────────
// profileId → { layout, widgets }
// Populated on hydration (active profile) + background prefetch (others).
// Saves current state before every switch so local mutations are preserved.

type ProfileData = {
	layout: UserDashboardLayoutRecord | null;
	widgets: UserWidgetInstanceRecord[];
};

const profileCache = new SvelteMap<string, ProfileData>();
let widgetsHydrated = false;

/** Serializes bg server switches — prevents out-of-order is_active writes. */
let bgSwitchQueue: Promise<void> = Promise.resolve();

// ── Helpers ──────────────────────────────────────────────────────────────────

function setThemeCookie(preset: string, mode: ThemeMode) {
	if (typeof document === 'undefined') return;
	const value = JSON.stringify({ preset, mode });
	document.cookie = `qo-theme=${encodeURIComponent(value)}; path=/; max-age=31536000`;
}

function applyThemeToDom(presetId: string, mode: ThemeMode) {
	if (typeof document === 'undefined') return;
	const preset = THEME_PRESETS[presetId];
	if (!preset) return;
	const vars = preset[mode];
	const root = document.documentElement;
	root.classList.remove('light', 'dark');
	root.classList.add(mode);
	Object.entries(vars).forEach(([key, value]) => {
		root.style.setProperty(`--${key}`, value);
	});
}

function syncThemeFromProfile(profile: UserProfileRecord | null) {
	if (!profile) return;
	const mode = profile.theme_mode as ThemeMode;
	if (!THEME_PRESETS[profile.theme_preset] || (mode !== 'light' && mode !== 'dark')) return;
	applyThemeToDom(profile.theme_preset, mode);
	setThemeCookie(profile.theme_preset, mode);
}

/** Fire-and-forget server call. Errors logged, UI stays correct. */
function bgSync<T>(fn: () => Promise<T>): void {
	fn().catch(console.error);
}

/** Save current active profile's widget/layout state to cache before switching. */
function saveCurrentToCache() {
	if (activeProfileId) {
		profileCache.set(activeProfileId, { layout, widgets });
	}
}

/** Background-prefetch dashboard data for all profiles not yet in cache. */
function prefetchProfiles() {
	for (const profile of profiles) {
		if (profile.id === activeProfileId) continue;
		if (profileCache.has(profile.id)) continue;
		loadProfileDashboard(profile.id)
			.then((data: ProfileData) => {
				if (!profileCache.has(profile.id)) {
					profileCache.set(profile.id, data);
				}
			})
			.catch(() => {});
	}
}

// ── Exported Store ───────────────────────────────────────────────────────────

export const dashboard = {
	// ── Getters ──────────────────────────────────────────────────────────────

	get profiles() {
		return profiles;
	},
	get activeProfileId() {
		return activeProfileId;
	},
	get activeProfile(): UserProfileRecord | null {
		return profiles.find((p) => p.id === activeProfileId) ?? null;
	},
	get layout() {
		return layout;
	},
	get widgets() {
		return widgets;
	},
	get editMode() {
		return editMode;
	},
	get switching() {
		return switching;
	},
	get saving() {
		return saving;
	},
	get hasPendingChanges() {
		return pendingPositions !== null;
	},

	// ── Hydration ───────────────────────────────────────────────────────────

	/** Called from +layout.svelte — seeds profile data for sidebar. */
	hydrateProfiles(serverProfiles: UserProfileRecord[], serverActive: UserProfileRecord | null) {
		// untrack: these reads/writes must not become dependencies of the calling $effect
		untrack(() => {
			profiles = serverProfiles;
			activeProfileId = serverActive?.id ?? null;

			if (widgetsHydrated && activeProfileId && !profileCache.has(activeProfileId)) {
				profileCache.set(activeProfileId, { layout, widgets });
			}
			syncThemeFromProfile(serverActive ?? serverProfiles[0] ?? null);
			prefetchProfiles();
		});
	},

	/** Called from +page.svelte — seeds widget/layout data for dashboard. */
	hydrateWidgets(
		serverLayout: UserDashboardLayoutRecord | null,
		serverWidgets: UserWidgetInstanceRecord[]
	) {
		// untrack: prevents internal state reads (switching, activeProfileId, profileCache)
		// from becoming dependencies of the calling $effect
		untrack(() => {
			if (switching) return;
			layout = serverLayout;
			widgets = serverWidgets;
			widgetsHydrated = true;

			if (activeProfileId) {
				profileCache.set(activeProfileId, { layout: serverLayout, widgets: serverWidgets });
			}
			prefetchProfiles();
		});
	},

	// ── Profile Operations ──────────────────────────────────────────────────

	switchProfile(id: string) {
		if (id === activeProfileId) return;

		const profile = profiles.find((p) => p.id === id);
		if (!profile) return;

		// 1. Preserve current profile's local state in cache
		saveCurrentToCache();

		// 2. Switch profile and sync its saved theme immediately
		activeProfileId = id;
		syncThemeFromProfile(profile);

		// 3. Load widgets from cache (instant) or fetch on miss
		const cached = profileCache.get(id);
		if (cached) {
			layout = cached.layout;
			widgets = cached.widgets;
		} else {
			switching = true;
			loadProfileDashboard(id)
				.then((data: ProfileData) => {
					if (activeProfileId !== id) return;
					layout = data.layout;
					widgets = data.widgets;
					profileCache.set(id, data);
				})
				.catch((err: unknown) => console.error('Failed to load profile:', err))
				.finally(() => {
					if (activeProfileId === id) switching = false;
				});
		}

		// 4. Background sync is_active flag — serialized to prevent ordering issues
		bgSwitchQueue = bgSwitchQueue
			.catch(() => {})
			.then(async () => {
				if (activeProfileId !== id) return;
				await switchProfileCmd({ profileId: id });
			});
	},

	renameProfile(id: string, name: string) {
		profiles = profiles.map((p) =>
			p.id === id ? ({ ...p, profile_name: name } as UserProfileRecord) : p
		);
		bgSync(() => updateProfileCmd({ profileId: id, profileName: name }));
	},

	async createProfile(opts: {
		name: string;
		profileType: 'work' | 'personal' | 'custom';
		profileIcon: string;
		profileColor: string;
		sourceProfileId?: string;
	}): Promise<UserProfileRecord | null> {
		let newProfile: UserProfileRecord | undefined;

		try {
			if (opts.sourceProfileId) {
				newProfile = (await duplicateProfileCmd({
					sourceProfileId: opts.sourceProfileId,
					profileName: opts.name
				})) as UserProfileRecord | undefined;
			} else {
				newProfile = (await createProfileCmd({
					profileName: opts.name,
					profileType: opts.profileType,
					profileIcon: opts.profileIcon,
					profileColor: opts.profileColor
				})) as UserProfileRecord | undefined;
			}

			if (newProfile?.id) {
				profiles = [...profiles, newProfile];
				dashboard.switchProfile(newProfile.id);
				return newProfile;
			}
		} catch (e) {
			console.error('Failed to create/duplicate profile', e);
		}
		return null;
	},

	deleteProfile(id: string) {
		if (profiles.length <= 1) return;

		const wasActive = id === activeProfileId;
		profileCache.delete(id);
		profiles = profiles.filter((p) => p.id !== id);

		bgSync(() => deleteProfileCmd({ profileId: id }));

		if (wasActive && profiles.length > 0) {
			dashboard.switchProfile(profiles[0].id);
		}
	},

	// ── Dashboard Pin Operations ────────────────────────────────────────────

	pinDashboard(id: string) {
		profiles = profiles.map((p) =>
			p.id === id ? ({ ...p, is_pinned: true } as UserProfileRecord) : p
		);
		bgSync(() => updateProfileCmd({ profileId: id, isPinned: true }));
	},

	unpinDashboard(id: string) {
		profiles = profiles.map((p) =>
			p.id === id ? ({ ...p, is_pinned: false } as UserProfileRecord) : p
		);
		bgSync(() => updateProfileCmd({ profileId: id, isPinned: false }));
	},

	/** Add a profile created server-side (e.g. from a template) into local state. */
	addProfileFromTemplate(profile: UserProfileRecord) {
		profiles = [...profiles, profile];
	},

	reorderDashboards(orderedIds: string[]) {
		profiles = profiles.map((p) => {
			const idx = orderedIds.indexOf(p.id);
			return idx >= 0 ? ({ ...p, sort_order: idx } as UserProfileRecord) : p;
		});
		for (let i = 0; i < orderedIds.length; i++) {
			const id = orderedIds[i];
			bgSync(() => updateProfileCmd({ profileId: id, sortOrder: i }));
		}
	},

	// ── Theme Operations ────────────────────────────────────────────────────

	updateTheme(preset: string, mode: ThemeMode) {
		applyThemeToDom(preset, mode);
		setThemeCookie(preset, mode);
		// Update active profile so $derived selectors reflect the change
		if (activeProfileId) {
			profiles = profiles.map((p) =>
				p.id === activeProfileId
					? ({ ...p, theme_preset: preset, theme_mode: mode } as UserProfileRecord)
					: p
			);
			bgSync(() =>
				updateProfileCmd({ profileId: activeProfileId!, themePreset: preset, themeMode: mode })
			);
		}
	},

	// ── Widget Operations (all local-first) ─────────────────────────────────

	addWidget(widgetType: string, title: string, size: WidgetSize, category?: string) {
		if (!layout) return;

		const customConfig = category ? { category } : {};
		const tempId = `temp-${Date.now()}`;
		const currentLayoutId = layout.id;
		const order = widgets.length;

		const tempWidget: UserWidgetInstanceRecord = {
			id: tempId,
			created: Date.now().toString(),
			updated: Date.now().toString(),
			dashboard: currentLayoutId,
			user: '',
			widget_type: widgetType,
			widget_title: title,
			position: { order, size },
			custom_config: customConfig,
			visual_config: null,
			is_visible: true,
			created_by_ai: false,
			ai_generation_prompt: ''
		};

		widgets = [...widgets, tempWidget];

		addWidgetCmd({
			dashboardId: currentLayoutId,
			widgetType,
			widgetTitle: title,
			position: { order, size },
			customConfig
		})
			.then(async (created) => {
				const record = (await created) as UserWidgetInstanceRecord | undefined;
				if (record) {
					widgets = widgets.map((w) => (w.id === tempId ? record : w));
				}
			})
			.catch(() => {
				widgets = widgets.filter((w) => w.id !== tempId);
			});
	},

	removeWidget(id: string) {
		const removed = widgets.find((w) => w.id === id);
		if (!removed) return;

		widgets = widgets.filter((w) => w.id !== id);

		removeWidgetCmd({ widgetId: id }).catch(() => {
			if (removed) widgets = [...widgets, removed];
		});
	},

	updateWidget(id: string, updates: Partial<UserWidgetInstanceRecord>) {
		const original = widgets.find((w) => w.id === id);
		if (!original) return;

		widgets = widgets.map((w) => (w.id === id ? { ...w, ...updates } : w));

		updateWidgetCmd({
			widgetId: id,
			...(updates.widget_title !== undefined && { widgetTitle: updates.widget_title }),
			...(updates.position !== undefined && { position: updates.position }),
			...(updates.custom_config !== undefined && { customConfig: updates.custom_config }),
			...(updates.visual_config !== undefined && {
				visualConfig: updates.visual_config ?? undefined
			}),
			...(updates.is_visible !== undefined && { isVisible: updates.is_visible })
		}).catch(() => {
			widgets = widgets.map((w) => (w.id === id ? original : w));
		});
	},

	reorderWidgets(positions: { widgetId: string; position: WidgetPosition }[]) {
		widgets = widgets.map((w) => {
			const update = positions.find((p) => p.widgetId === w.id);
			return update ? { ...w, position: update.position } : w;
		});
		pendingPositions = positions;
	},

	// ── Edit Mode ───────────────────────────────────────────────────────────

	enterEditMode() {
		editMode = true;
	},

	async exitEditMode() {
		if (pendingPositions && layout) {
			saving = true;
			try {
				await saveLayoutCmd({
					dashboardId: layout.id,
					widgetPositions: pendingPositions.map((p) => ({
						widgetId: p.widgetId,
						position: p.position
					}))
				});
			} catch (err) {
				console.error('Failed to save layout:', err);
			} finally {
				pendingPositions = null;
				saving = false;
			}
		}
		editMode = false;
	}
};
