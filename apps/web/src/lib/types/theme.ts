/**
 * Client-safe theme types and preset list for the ThemeSelector UI.
 * This is a subset of lib/server/theme.ts data that's safe for client use.
 */

export type ThemeMode = 'light' | 'dark';

export interface ThemePresetInfo {
	id: string;
	label: string;
	group: 'base' | 'premium' | 'brand';
}

/**
 * Preset metadata for the ThemeSelector UI.
 * Must stay in sync with THEME_PRESETS in lib/server/theme.ts.
 */
export const THEME_PRESET_LIST: ThemePresetInfo[] = [
	// Base palettes
	{ id: 'orion', label: 'Orion', group: 'base' },
	{ id: 'slate', label: 'Slate', group: 'base' },
	{ id: 'zinc', label: 'Zinc', group: 'base' },
	{ id: 'stone', label: 'Stone', group: 'base' },
	{ id: 'neutral', label: 'Neutral', group: 'base' },
	{ id: 'rose', label: 'Rose', group: 'base' },
	{ id: 'amber', label: 'Amber', group: 'base' },

	// Premium presets
	{ id: 'amber-minimal', label: 'Amber Minimal', group: 'premium' },
	{ id: 'clean-slate', label: 'Clean Slate', group: 'premium' },
	{ id: 'graphite', label: 'Graphite', group: 'premium' },
	{ id: 'bubblegum', label: 'Bubblegum', group: 'premium' },
	{ id: 'tangerine', label: 'Tangerine', group: 'premium' },
	{ id: 'soft-pop', label: 'Soft Pop', group: 'premium' },
	{ id: 'northern-lights', label: 'Northern Lights', group: 'premium' },
	{ id: 'amethyst-haze', label: 'Amethyst Haze', group: 'premium' },
	{ id: 'perpetuity', label: 'Perpetuity', group: 'premium' },
	{ id: 'claymorphism', label: 'Claymorphism', group: 'premium' },

	// Brand themes
	{ id: 'claude', label: 'Claude', group: 'brand' },
	{ id: 'green-claude', label: 'Green Claude', group: 'brand' },
	{ id: 'vercel', label: 'Vercel', group: 'brand' },
	{ id: 'supabase', label: 'Supabase', group: 'brand' },
	{ id: 'customizable-web', label: 'Customizable Web', group: 'brand' },
	{ id: 'steen', label: 'Steen', group: 'brand' },
	{ id: 'care', label: 'Care', group: 'brand' },
	{ id: 'navy', label: 'Navy', group: 'brand' },
	{ id: 'the-horta', label: 'The Horta', group: 'brand' },
	{ id: 'healthy-brain', label: 'Healthy Brain', group: 'brand' },
	{ id: 'versatile-design', label: 'Versatile Design', group: 'brand' },
	{ id: 'epic-labs', label: 'Epic Labs', group: 'brand' },
	{ id: 'stylish-customization', label: 'Stylish Customization', group: 'brand' }
];

export const THEME_GROUPS = {
	base: { label: 'Base', description: 'Core color palettes' },
	premium: { label: 'Premium', description: 'Designer themes' },
	brand: { label: 'Brand', description: 'Inspired by popular products' }
} as const;
