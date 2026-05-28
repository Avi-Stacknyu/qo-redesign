/**
 * Theme Store - Unified Theme Management using Svelte 5 Runes
 *
 * Architecture:
 * - Server as source of truth (for authenticated users)
 * - localStorage as cache (fast initial load)
 * - $state runes for fine-grained reactivity
 * - Debounced server persistence (400ms) to batch updates
 *
 * Flow:
 * 1. Initial load: Read from localStorage → Apply immediately
 * 2. On auth: Load from server → Override localStorage if different
 * 3. On change: Update state → Apply to DOM → Save to localStorage → Debounced server save
 */

import { browser } from '$app/environment';
import type { ThemeMode, ThemePreset, ThemeState, ThemeStyles, ThemeStyleProps } from './types';
import { saveTheme } from '$lib/remote/theme.remote';
import { tweakcnPresets } from './tweakcn-presets';

const STORAGE_KEY = 'quantpm.theme';
const SERVER_PERSIST_DEBOUNCE_MS = 400;

// ============================================================================
// THEME PRESETS & DEFAULT
// ============================================================================

// Available theme presets from tweakcn-presets package
const presets: Record<string, ThemePreset> = tweakcnPresets;

const quantOrionTheme: ThemeStyles = {
	light: {
		background: 'oklch(1 0 0)',
		foreground: 'oklch(0.129 0.042 264.695)',
		card: 'oklch(1 0 0)',
		'card-foreground': 'oklch(0.129 0.042 264.695)',
		popover: 'oklch(1 0 0)',
		'popover-foreground': 'oklch(0.129 0.042 264.695)',
		primary: 'oklch(0.208 0.042 265.755)',
		'primary-foreground': 'oklch(0.984 0.003 247.858)',
		secondary: 'oklch(0.968 0.007 247.896)',
		'secondary-foreground': 'oklch(0.208 0.042 265.755)',
		muted: 'oklch(0.968 0.007 247.896)',
		'muted-foreground': 'oklch(0.554 0.046 257.417)',
		accent: 'oklch(0.968 0.007 247.896)',
		'accent-foreground': 'oklch(0.208 0.042 265.755)',
		destructive: 'oklch(0.577 0.245 27.325)',
		border: 'oklch(0.929 0.013 255.508)',
		input: 'oklch(0.929 0.013 255.508)',
		ring: 'oklch(0.704 0.04 256.788)',
		'chart-1': 'oklch(0.646 0.222 41.116)',
		'chart-2': 'oklch(0.6 0.118 184.704)',
		'chart-3': 'oklch(0.398 0.07 227.392)',
		'chart-4': 'oklch(0.828 0.189 84.429)',
		'chart-5': 'oklch(0.769 0.188 70.08)',
		radius: '0.625rem',
		sidebar: 'oklch(0.984 0.003 247.858)',
		'sidebar-foreground': 'oklch(0.129 0.042 264.695)',
		'sidebar-primary': 'oklch(0.208 0.042 265.755)',
		'sidebar-primary-foreground': 'oklch(0.984 0.003 247.858)',
		'sidebar-accent': 'oklch(0.968 0.007 247.896)',
		'sidebar-accent-foreground': 'oklch(0.208 0.042 265.755)',
		'sidebar-border': 'oklch(0.929 0.013 255.508)',
		'sidebar-ring': 'oklch(0.704 0.04 256.788)',
		'font-sans': 'var(--font-sans)',
		'font-serif': 'var(--font-serif)',
		'font-mono': 'var(--font-mono)',
		'shadow-color': 'hsl(0 0% 0%)',
		'shadow-opacity': '0.1',
		'shadow-blur': '3px',
		'shadow-spread': '0px',
		'shadow-offset-x': '0',
		'shadow-offset-y': '1px'
	},
	dark: {
		background: 'oklch(0.129 0.042 264.695)',
		foreground: 'oklch(0.984 0.003 247.858)',
		card: 'oklch(0.208 0.042 265.755)',
		'card-foreground': 'oklch(0.984 0.003 247.858)',
		popover: 'oklch(0.208 0.042 265.755)',
		'popover-foreground': 'oklch(0.984 0.003 247.858)',
		primary: 'oklch(0.929 0.013 255.508)',
		'primary-foreground': 'oklch(0.208 0.042 265.755)',
		secondary: 'oklch(0.279 0.041 260.031)',
		'secondary-foreground': 'oklch(0.984 0.003 247.858)',
		muted: 'oklch(0.279 0.041 260.031)',
		'muted-foreground': 'oklch(0.704 0.04 256.788)',
		accent: 'oklch(0.279 0.041 260.031)',
		'accent-foreground': 'oklch(0.984 0.003 247.858)',
		destructive: 'oklch(0.704 0.191 22.216)',
		border: 'oklch(1 0 0 / 10%)',
		input: 'oklch(1 0 0 / 15%)',
		ring: 'oklch(0.551 0.027 264.364)',
		'chart-1': 'oklch(0.488 0.243 264.376)',
		'chart-2': 'oklch(0.696 0.17 162.48)',
		'chart-3': 'oklch(0.769 0.188 70.08)',
		'chart-4': 'oklch(0.627 0.265 303.9)',
		'chart-5': 'oklch(0.645 0.246 16.439)',
		sidebar: 'oklch(0.208 0.042 265.755)',
		'sidebar-foreground': 'oklch(0.984 0.003 247.858)',
		'sidebar-primary': 'oklch(0.488 0.243 264.376)',
		'sidebar-primary-foreground': 'oklch(0.984 0.003 247.858)',
		'sidebar-accent': 'oklch(0.279 0.041 260.031)',
		'sidebar-accent-foreground': 'oklch(0.984 0.003 247.858)',
		'sidebar-border': 'oklch(1 0 0 / 10%)',
		'sidebar-ring': 'oklch(0.551 0.027 264.364)',
		'font-sans': 'var(--font-sans)',
		'font-serif': 'var(--font-serif)',
		'font-mono': 'var(--font-mono)',
		'shadow-color': 'hsl(0 0% 0%)',
		'shadow-opacity': '0.3',
		'shadow-blur': '8px',
		'shadow-spread': '0px',
		'shadow-offset-x': '0',
		'shadow-offset-y': '4px'
	}
};

// ============================================================================
// THEME UTILITIES
// ============================================================================

/**
 * Resolves theme styles by merging preset with Quant Orion base theme
 * Presets override base theme values while preserving unspecified properties
 *
 * @param name - Preset ID or 'default'
 * @param customPresets - Optional custom presets to use instead of built-in
 * @returns Complete theme styles for both light and dark modes
 */
function getPresetThemeStyles(
	name: string,
	customPresets?: Record<string, ThemePreset>
): ThemeStyles {
	const presetsToUse = customPresets || presets;

	// Return base Quant Orion theme for 'default'
	// To use a preset as default instead, uncomment and modify:
	// return getPresetThemeStyles('amber-minimal', customPresets);
	if (name === 'default') {
		return quantOrionTheme;
	}

	const preset = presetsToUse[name];

	// Fallback to Quant Orion theme if preset not found
	if (!preset) {
		console.warn(`Preset "${name}" not found, using default theme`);
		return quantOrionTheme;
	}

	// Merge preset styles with base theme (preset values override base)
	return {
		light: {
			...quantOrionTheme.light,
			...(preset.styles.light || {})
		},
		dark: {
			...quantOrionTheme.dark,
			...(preset.styles.light || {}),
			...(preset.styles.dark || {})
		}
	};
}

/**
 * Apply theme to DOM by injecting CSS variables
 * Uses requestAnimationFrame to batch DOM updates and prevent layout thrashing
 * OKLCH colors are used directly without conversion (modern color space support)
 *
 * Routes Exclusion: Certain routes should use system theme (no custom CSS applied)
 */
function applyTheme(themeState: ThemeState): void {
	if (!browser) return;

	// Routes that should NOT have custom theme (use system/default theme instead)
	const EXCLUDED_ROUTES = ['/login', '/register', '/onboarding', '/plans'];
	const currentPath = window.location.pathname;
	const isExcluded = EXCLUDED_ROUTES.some((route) => currentPath.includes(route));

	if (isExcluded) {
		console.log('[Theme] Skipping theme application for excluded route:', currentPath);
		return;
	}

	window.requestAnimationFrame(() => {
		const { currentMode, styles } = themeState;
		const themeStyles = styles[currentMode];
		const root = document.documentElement;

		// Remove existing theme style elements (including hydration)
		const existingStyle = document.getElementById('theme-variables');
		if (existingStyle) {
			existingStyle.remove();
		}
		const hydrationStyle = document.getElementById('theme-hydration');
		if (hydrationStyle) {
			hydrationStyle.remove();
		}

		// Build CSS text with all theme variables
		let cssText = ':root {\n';
		for (const [key, value] of Object.entries(themeStyles)) {
			if (value && typeof value === 'string') {
				cssText += `  --${key}: ${value};\n`;
			}
		}
		// Set color-scheme for browser UI (scrollbars, form controls, etc.)
		cssText +=
			currentMode === 'dark' ? '  color-scheme: dark;\n}\n' : '  color-scheme: light;\n}\n';

		// Inject new style element
		const styleEl = document.createElement('style');
		styleEl.id = 'theme-variables';
		styleEl.textContent = cssText;
		document.head.appendChild(styleEl);

		// Toggle .dark class for Tailwind dark mode support
		root.classList.toggle('dark', currentMode === 'dark');
	});
}

// ============================================================================
// STATE & INTERFACES
// ============================================================================

/** localStorage format for theme selection (includes pre-built CSS for instant hydration) */
interface StoredSelection {
	preset?: string;
	currentMode?: ThemeMode;
	// Pre-built CSS strings for instant app.html hydration (no loop needed!)
	cssCache?: {
		light?: string;
		dark?: string;
	};
}

/** UI format for theme preset options (includes resolved styles for preview) */
export interface ThemePresetOption {
	id: string;
	label: string;
	styles: ThemeStyles;
	createdAt?: string;
}

// ============================================================================
// REACTIVE STATE (Svelte 5 Runes)
// ============================================================================

/** User-added custom presets (from server or runtime) */
let cachedCustomPresets = $state<Record<string, ThemePreset>>({});

/** Database record ID for server persistence */
let customizationRecordId = $state<string | null>(null);

/** Whether user is authenticated (enables server persistence) */
let isAuthenticated = $state(false);

/** Timeout ID for debounced server save */
let persistTimeout: number | null = null;

/** Core theme state - reactive via $state rune */
const themeStore = $state<ThemeState>(buildInitialThemeState());

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/** Merges built-in and custom presets */
function getPresetCollection(): Record<string, ThemePreset> {
	return { ...presets, ...cachedCustomPresets };
}

/** Checks if preset exists in available presets */
function isKnownPreset(name: string): boolean {
	return name === 'default' || Boolean(getPresetCollection()[name]);
}

/** Resolves preset to full theme styles (deep clone to prevent mutations) */
function resolveStyles(preset: string): ThemeStyles {
	return structuredClone(getPresetThemeStyles(preset, getPresetCollection()));
}

/**
 * Build complete theme state from selection
 * Validates preset and mode, falls back to defaults if invalid
 */
function buildThemeState(selection?: StoredSelection): ThemeState {
	const presetName =
		selection?.preset && isKnownPreset(selection.preset) ? selection.preset : 'default';
	const mode: ThemeMode = selection?.currentMode === 'dark' ? 'dark' : 'light';

	return {
		currentMode: mode,
		preset: presetName,
		styles: resolveStyles(presetName)
	};
}

/** Read theme preference from localStorage (client-side cache) */
function readStoredSelection(): StoredSelection | undefined {
	if (!browser) return undefined;

	try {
		const rawValue = window.localStorage.getItem(STORAGE_KEY);
		if (!rawValue) return undefined;

		const parsed = JSON.parse(rawValue) as StoredSelection;
		return {
			preset: typeof parsed.preset === 'string' ? parsed.preset : undefined,
			currentMode: parsed.currentMode === 'dark' ? 'dark' : 'light'
		};
	} catch (error) {
		console.warn('Unable to read stored theme preference', error);
		return undefined;
	}
}

/**
 * Initialize theme state on module load
 * Reads from localStorage and applies immediately (applyTheme handles route exclusion)
 */
function buildInitialThemeState(): ThemeState {
	const state = buildThemeState(readStoredSelection());

	if (browser) {
		applyTheme(state);
	}

	return state;
}

/**
 * Save theme preference to localStorage (synchronous cache)
 * Now includes pre-built CSS strings for instant hydration in app.html
 */
function persistSelection(state: ThemeState): void {
	if (!browser) return;

	try {
		// Build CSS strings for both modes (for instant hydration)
		const buildCSSString = (styles: ThemeStyleProps): string => {
			let css = '';
			for (const [key, value] of Object.entries(styles)) {
				if (value && typeof value === 'string') {
					css += `--${key}:${value};`;
				}
			}
			return css;
		};

		const payload: StoredSelection = {
			preset: state.preset,
			currentMode: state.currentMode,
			// Store pre-built CSS strings for instant app.html hydration
			cssCache: {
				light: buildCSSString(state.styles.light),
				dark: buildCSSString(state.styles.dark)
			}
		};
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
	} catch (error) {
		console.warn('Failed to cache theme preference locally', error);
	}
} /**
 * Save theme to server (user_customization table)
 * Only runs when authenticated
 */
async function persistThemeToServer(selection: StoredSelection): Promise<void> {
	if (!browser || !isAuthenticated) return;

	try {
		const result = await saveTheme({
			preset: selection.preset ?? 'default',
			currentMode: selection.currentMode ?? 'light',
			recordId: customizationRecordId ?? undefined
		});

		// Store record ID for future updates
		if (result?.recordId) {
			customizationRecordId = result.recordId;
		}
	} catch (error) {
		console.error('Failed to persist theme to server', error);
	}
}

/**
 * Debounce server persistence to batch rapid changes
 * Prevents excessive API calls when user toggles theme multiple times
 */
function debouncedServerPersist(selection: StoredSelection): void {
	if (!browser || !isAuthenticated) return;

	// Clear existing timeout to reset debounce timer
	if (persistTimeout !== null) {
		window.clearTimeout(persistTimeout);
	}

	persistTimeout = window.setTimeout(() => {
		persistTimeout = null;
		void persistThemeToServer(selection);
	}, SERVER_PERSIST_DEBOUNCE_MS);
}

/**
 * Sync theme state to DOM and persistence layers
 * Called whenever theme changes (mode toggle, preset selection, etc.)
 */
function syncThemeState(): void {
	if (!browser) return;

	// 1. Apply to DOM immediately (optimistic UI)
	applyTheme(themeStore);

	// 2. Save to localStorage (synchronous cache)
	persistSelection(themeStore);

	// 3. Debounced server save (if authenticated)
	if (isAuthenticated) {
		debouncedServerPersist({
			preset: themeStore.preset,
			currentMode: themeStore.currentMode
		});
	}
}

// ============================================================================
// EXPORTED API - Theme Access & Manipulation
// ============================================================================

/**
 * Get full theme state (reactive)
 * Use with $derived in components for automatic reactivity
 * @example let theme = $derived(getThemeState())
 */
export function getThemeState(): ThemeState {
	return themeStore;
}

/** Get current theme mode (light/dark) - reactive */
export function getCurrentMode(): ThemeMode {
	return themeStore.currentMode;
}

/** Get current preset ID - reactive */
export function getCurrentPreset(): string {
	return themeStore.preset;
}

/** Set theme mode (light/dark) */
export function setThemeMode(mode: ThemeMode): void {
	if (themeStore.currentMode === mode) return;

	themeStore.currentMode = mode;
	syncThemeState();
}

/** Toggle between light and dark mode */
export function toggleThemeMode(): void {
	themeStore.currentMode = themeStore.currentMode === 'dark' ? 'light' : 'dark';
	syncThemeState();
}

/** Set theme preset by ID */
export function setThemePreset(preset: string): void {
	if (!isKnownPreset(preset)) {
		console.warn(`Unknown theme preset: ${preset}`);
		return;
	}

	themeStore.preset = preset;
	themeStore.styles = resolveStyles(preset);
	syncThemeState();
}

/**
 * List all available theme presets with resolved styles
 * Used by ThemeSelector component to show preset options
 */
export function listThemePresets(): ThemePresetOption[] {
	const collection = getPresetCollection();

	return [
		{
			id: 'default',
			label: 'Quant Orion',
			styles: resolveStyles('default')
		},
		...Object.entries(collection).map(([id, preset]) => ({
			id,
			label: preset.label,
			styles: resolveStyles(id),
			createdAt: preset.createdAt
		}))
	];
}

/**
 * Register custom theme presets (typically from server)
 * If current preset becomes invalid, resets to default
 */
export function registerThemePresets(entries: Record<string, ThemePreset>): void {
	cachedCustomPresets = { ...entries };

	// Reset to default if current preset is no longer available
	if (!isKnownPreset(themeStore.preset)) {
		const newState = buildThemeState({ currentMode: themeStore.currentMode, preset: 'default' });
		themeStore.currentMode = newState.currentMode;
		themeStore.preset = newState.preset;
		themeStore.styles = newState.styles;
		syncThemeState();
	} else {
		// Re-resolve styles in case preset definitions changed
		themeStore.styles = resolveStyles(themeStore.preset);
		syncThemeState();
	}
}

/**
 * Enable/disable server persistence (call when auth state changes)
 * Clears pending saves when disabled to prevent stale requests
 */
export function setThemeServerPersistenceEnabled(enabled: boolean): void {
	if (isAuthenticated === enabled) return;

	isAuthenticated = enabled;

	// Clear pending debounced save when logging out
	if (!enabled && browser && persistTimeout !== null) {
		window.clearTimeout(persistTimeout);
		persistTimeout = null;
	}
}

/**
 * Apply theme preference from server (called on auth/page load)
 * Server theme overrides localStorage (server is source of truth)
 * Includes guard to prevent unnecessary re-application
 */
export function applyServerThemePreference(
	selection?: StoredSelection,
	recordId?: string | null
): void {
	customizationRecordId = recordId ?? null;

	// Early return if no selection provided
	if (!selection?.preset) return;

	const sanitizedSelection: StoredSelection = {
		preset: selection.preset,
		currentMode: selection.currentMode === 'dark' ? 'dark' : 'light'
	};

	// Skip if theme is already applied (prevents flickering on navigation)
	if (
		themeStore.preset === sanitizedSelection.preset &&
		themeStore.currentMode === sanitizedSelection.currentMode
	) {
		return;
	}

	// Apply server theme as source of truth
	const newState = buildThemeState(sanitizedSelection);
	themeStore.currentMode = newState.currentMode;
	themeStore.preset = newState.preset;
	themeStore.styles = newState.styles;

	// Apply to DOM and cache locally (don't trigger server save - we're loading FROM server)
	if (browser) {
		applyTheme(themeStore);
		persistSelection(themeStore);
	}
}

/** Set database record ID for server persistence */
export function setThemeCustomizationRecordId(recordId: string | null): void {
	customizationRecordId = recordId;
}

/**
 * Clear theme on logout
 * Removes localStorage cache, resets to default theme, disables persistence
 */
export function clearThemeOnLogout(): void {
	if (!browser) return;

	try {
		// Clear localStorage cache
		window.localStorage.removeItem(STORAGE_KEY);

		// Reset to default Quant Orion theme
		const defaultState = buildThemeState();
		themeStore.currentMode = defaultState.currentMode;
		themeStore.preset = defaultState.preset;
		themeStore.styles = defaultState.styles;

		// Disable server persistence
		isAuthenticated = false;
		customizationRecordId = null;

		// Clear any pending debounced saves
		if (persistTimeout !== null) {
			window.clearTimeout(persistTimeout);
			persistTimeout = null;
		}

		// Apply default theme to DOM
		syncThemeState();
	} catch (error) {
		console.warn('Failed to clear theme on logout', error);
	}
}

/**
 * Remove custom theme from DOM (for routes that should use system theme)
 * Does NOT affect localStorage or state - only removes CSS variables from DOM
 */
export function removeCustomTheme(): void {
	if (!browser) return;

	window.requestAnimationFrame(() => {
		// Remove custom theme style elements
		const themeStyle = document.getElementById('theme-variables');
		if (themeStyle) {
			themeStyle.remove();
		}
		const hydrationStyle = document.getElementById('theme-hydration');
		if (hydrationStyle) {
			hydrationStyle.remove();
		}

		// Remove dark class (routes will use system preference via CSS)
		document.documentElement.classList.remove('dark');
	});
}

// Export storage key constant for external use
export { STORAGE_KEY as THEME_STORAGE_KEY };
