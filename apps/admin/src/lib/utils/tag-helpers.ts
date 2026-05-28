import type { TagRule } from '@repo/shared/types';
import type { ConfigTagCatalogRow, ConfigTagNamespaceRow } from '@repo/db/types';

/**
 * Type for config_tag_catalog record with expanded namespace.
 * The expand field will contain a namespace property with the full namespace record.
 */
export type TagCatalogWithNamespace = ConfigTagCatalogRow & {
	expand?: { namespace?: ConfigTagNamespaceRow };
};

/** Type-safe cast for tag catalog rows to TagCatalogWithNamespace[] */
export function asTagCatalogWithNamespace(
	tags: Record<string, unknown>[]
): TagCatalogWithNamespace[] {
	return tags as unknown as TagCatalogWithNamespace[];
}

/** Get the namespace name from an expanded tag catalog record */
export function getTagNamespaceName(tag: TagCatalogWithNamespace | ConfigTagCatalogRow): string {
	const t = tag as TagCatalogWithNamespace;
	return t.expand?.namespace?.name ?? 'unknown';
}

/** Get the full prefixed tag string (namespace:tag) from an expanded record */
export function getFullTagString(tag: TagCatalogWithNamespace | ConfigTagCatalogRow): string {
	return `${getTagNamespaceName(tag)}:${tag.tag}`;
}

/**
 * Default color classes for known namespaces.
 * New namespaces should store color_class in the database.
 */
const DEFAULT_NAMESPACE_COLORS: Record<string, string> = {
	tier: 'bg-purple-500/10 text-purple-500',
	geo: 'bg-blue-500/10 text-blue-500',
	role: 'bg-amber-500/10 text-amber-500',
	segment: 'bg-emerald-500/10 text-emerald-500'
};

/**
 * Runtime cache of namespace name → color_class, populated from database.
 * Call setNamespaceColors() to update after fetching namespaces.
 */
const namespaceColorCache = new Map<string, string>();

/** Populate the namespace color cache from fetched namespace records. */
export function setNamespaceColors(
	namespaces: Array<{ name: string; colorClass: string | null }>
): void {
	namespaceColorCache.clear();
	for (const ns of namespaces) {
		namespaceColorCache.set(ns.name, ns.colorClass ?? 'gray-500');
	}
}

/** Convert a color_class key (e.g. "purple") to Tailwind classes */
export function colorClassToTailwind(colorClass: string): string {
	switch (colorClass) {
		case 'purple':
			return 'bg-purple-500/10 text-purple-500';
		case 'blue':
			return 'bg-blue-500/10 text-blue-500';
		case 'amber':
			return 'bg-amber-500/10 text-amber-500';
		case 'emerald':
			return 'bg-emerald-500/10 text-emerald-500';
		case 'rose':
			return 'bg-rose-500/10 text-rose-500';
		case 'cyan':
			return 'bg-cyan-500/10 text-cyan-500';
		case 'orange':
			return 'bg-orange-500/10 text-orange-500';
		case 'indigo':
			return 'bg-indigo-500/10 text-indigo-500';
		default:
			return 'bg-gray-500/10 text-gray-500';
	}
}

/**
 * Get Tailwind classes for namespace-colored badges.
 * Checks runtime cache first, then falls back to defaults.
 */
export function getNamespaceColor(ns: string): string {
	// Check runtime cache (populated from database)
	const cachedColor = namespaceColorCache.get(ns);
	if (cachedColor) {
		return colorClassToTailwind(cachedColor);
	}
	// Fallback to hardcoded defaults
	return DEFAULT_NAMESPACE_COLORS[ns] ?? 'bg-gray-500/10 text-gray-500';
}

/** Human-readable description of a TagRule. */
export function describeTagRule(rule: TagRule | null | undefined, isUniversal: boolean): string {
	if (isUniversal) return 'Visible to all users';
	if (!rule || !rule.groups || rule.groups.length === 0)
		return 'No restrictions — visible to all users';

	const nonEmpty = rule.groups.filter((g) => g.tags.length > 0);
	if (nonEmpty.length === 0) return 'No restrictions — visible to all users';

	const parts = nonEmpty.map((g) => {
		if (g.tags.length === 1) return g.tags[0];
		return `(${g.tags.join(' AND ')})`;
	});

	if (parts.length === 1) return `Visible to users who match: ${parts[0]}`;
	return `Visible to users who match: ${parts.join(' OR ')}`;
}

/** Flatten a TagRule into a unique list of prefixed tags for badges/previews. */
export function getTagRuleTags(rule: TagRule | null | undefined): string[] {
	if (!rule?.groups?.length) return [];
	return [...new Set(rule.groups.flatMap((group) => group.tags))];
}
