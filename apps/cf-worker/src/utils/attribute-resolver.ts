/**
 * Attribute Resolver
 *
 * Resolves dynamic attributes from various sources for prompt injection
 * and other attribute-based features. Follows the same patterns as:
 * - utils/cloudflare-ai.ts (config caching)
 * - utils/context-builder.ts (user context building)
 *
 * IMPORTANT: Validates allowed_usages before returning attributes for specific purposes.
 * Agent visibility is handled by the tag-based system (tag-resolver.ts + tag-visibility.ts).
 */

import type { GraphNode } from '../types';
import type { Database } from '@repo/db/types';
import { configDynamicAttributes } from '@repo/db/schema';
import { eq } from 'drizzle-orm';
import { createLogger, formatError } from './logger';
import { createTTLCache } from './ttl-cache';

// ============================================================================
// Types
// ============================================================================

export type AttributeCategory = 'identity' | 'preference' | 'contextual' | 'derived';
export type AttributeUsage = 'prompt_injection' | 'notifications' | 'compliance' | 'analytics';

export interface ResolvedAttributes {
	[key: string]: unknown;
}

export interface AttributeDefinition {
	attribute_key: string;
	display_name: string;
	description?: string;
	category: AttributeCategory;
	allowed_usages: AttributeUsage[];
	source_type: 'cf_header' | 'user_fact' | 'client_provided' | 'explicit' | 'derived';
	source_config: {
		header?: string; // For cf_header
		fact_key?: string; // For user_fact
		header_name?: string; // For client_provided
		path?: string; // For explicit
		derive_from?: string[]; // For derived
		derive_function?: string; // For derived
	};
	data_type: 'string' | 'number' | 'boolean' | 'array' | 'date';
	default_value?: unknown;
	allowed_values?: unknown[];
	is_active: boolean;
	is_required_for_agents: boolean;
}

// ============================================================================
// Caching
// ============================================================================

const attributeDefCache = createTTLCache<AttributeDefinition[]>(5 * 60 * 1000);

/**
 * Load attribute definitions with caching
 * Mirrors the infra config loader cache pattern.
 */
export async function loadAttributeDefinitions(db: Database): Promise<AttributeDefinition[]> {
	const cached = attributeDefCache.get();
	if (cached) return cached;

	const records = await db
		.select()
		.from(configDynamicAttributes)
		.where(eq(configDynamicAttributes.isActive, true));

	const defs = records.map((r) => ({
		attribute_key: r.attributeKey as string,
		display_name: r.displayName as string,
		description: r.description as string | undefined,
		category: r.category as AttributeCategory,
		allowed_usages: r.allowedUsages as AttributeUsage[],
		source_type: r.sourceType as AttributeDefinition['source_type'],
		source_config: r.sourceConfig as AttributeDefinition['source_config'],
		data_type: r.dataType as AttributeDefinition['data_type'],
		default_value: r.defaultValue,
		allowed_values: r.allowedValues as unknown[] | undefined,
		is_active: r.isActive as boolean,
		is_required_for_agents: r.isRequiredForAgents as boolean
	}));

	attributeDefCache.set(defs);
	return defs;
}

// ============================================================================
// Resolution
// ============================================================================

/**
 * Resolve attribute request context
 * Can be either a Request object or a simplified cfHeaders + cfData object
 */
export interface AttributeResolutionContext {
	/** Cloudflare headers (lowercase keys) */
	headers: Record<string, string>;
	/** Cloudflare request data (cf object) */
	cf?: {
		country?: string;
		timezone?: string;
		region?: string;
		city?: string;
		[key: string]: unknown;
	};
}

/**
 * Create attribute resolution context from CF headers passed as object
 */
export function createContextFromHeaders(
	cfHeaders: Record<string, string>
): AttributeResolutionContext {
	return {
		headers: cfHeaders,
		cf: {
			country: cfHeaders['cf-ipcountry'],
			timezone: cfHeaders['cf-timezone'],
			region: cfHeaders['cf-region'],
			city: cfHeaders['cf-city']
		}
	};
}

/**
 * Resolves all active attributes for a user
 * Similar pattern to buildUserContext() in context-builder.ts
 *
 * @param ctx - Resolution context (from request or headers)
 * @param userId - The user's ID
 * @param userFacts - User facts from graph memory
 * @param attributeDefinitions - The loaded attribute definitions
 */
export function resolveAttributes(
	ctx: AttributeResolutionContext,
	userId: string,
	userFacts: GraphNode[],
	attributeDefinitions: AttributeDefinition[],
	profileNodes: GraphNode[] = []
): ResolvedAttributes {
	const attributes: ResolvedAttributes = {};

	for (const def of attributeDefinitions) {
		try {
			const value = resolveAttribute(ctx, userId, userFacts, def, profileNodes);
			attributes[def.attribute_key] = value ?? def.default_value;
		} catch (e) {
			// Use default value on error
			if (def.default_value !== undefined) {
				attributes[def.attribute_key] = def.default_value;
			}
			const log = createLogger('AttributeResolver', { userId });
			log.warn('resolve_failed', { key: def.attribute_key, ...formatError(e) });
		}
	}

	// Fallback: If residence_country is missing but current_location exists, use it
	// This handles edge cases where lazy capture hasn't run yet
	if (!attributes['residence_country'] && ctx.cf?.country) {
		attributes['residence_country'] = ctx.cf.country;
		const log = createLogger('AttributeResolver');
		log.debug('residence_country_fallback', { country: ctx.cf.country });
	}

	// Fallback: If home_timezone is missing but current_timezone exists, use it
	if (!attributes['home_timezone'] && ctx.cf?.timezone) {
		attributes['home_timezone'] = ctx.cf.timezone;
	}

	return attributes;
}

/**
 * Resolve a single attribute based on its source type
 */
function resolveAttribute(
	ctx: AttributeResolutionContext,
	userId: string,
	userFacts: GraphNode[],
	def: AttributeDefinition,
	profileNodes: GraphNode[] = []
): unknown {
	switch (def.source_type) {
		case 'cf_header': {
			const header = def.source_config.header;
			if (!header) return undefined;

			// Cloudflare special headers via cf object
			if (header === 'cf-ipcountry') {
				return ctx.cf?.country;
			}
			if (header === 'cf-timezone') {
				return ctx.cf?.timezone;
			}
			if (header === 'cf-region') {
				return ctx.cf?.region;
			}
			if (header === 'cf-city') {
				return ctx.cf?.city;
			}
			// Fallback to standard headers
			return ctx.headers[header.toLowerCase()];
		}

		case 'user_fact': {
			const factKey = def.source_config.fact_key;
			if (!factKey) return undefined;

			// Match by factKey in data or by node ID (fact::location::factKey or fact::onboarding::factKey format)
			const fact = userFacts.find(
				(f) =>
					f.data?.factKey === factKey ||
					f.data?.key === factKey ||
					f.id === `fact::${factKey}` ||
					f.id === `fact::location::${factKey}` ||
					f.id === `fact::onboarding::${factKey}` ||
					f.id === factKey
			);
			if (fact) {
				return fact.data?.rawValue ?? fact.data?.answer ?? fact.data?.value ?? fact.data;
			}

			// Fallback: search profile section fields for matching key
			for (const node of profileNodes) {
				const fields = node.data?.fields as Record<string, { value?: string }> | undefined;
				if (fields?.[factKey]?.value) {
					return fields[factKey].value;
				}
			}
			return undefined;
		}

		case 'client_provided': {
			const headerName = def.source_config.header_name;
			if (!headerName) return undefined;
			return ctx.headers[headerName.toLowerCase()];
		}

		case 'explicit': {
			const path = def.source_config.path;
			if (!path) return undefined;
			if (path === 'user.id') return userId;
			// Add more explicit paths as needed
			return undefined;
		}

		case 'derived': {
			// TODO: implement derived attributes (age_from_birthdate, income_bracket, etc.)
			createLogger('AttributeResolver').debug('derived_attr_not_implemented', {
				key: def.attribute_key
			});
			return undefined;
		}

		default:
			return undefined;
	}
}

// ============================================================================
// Usage Validation (prevents misuse of contextual attributes)
// ============================================================================

/**
 * Filter attributes by allowed usage
 *
 * @param allAttributes - All resolved attributes
 * @param attributeDefinitions - The loaded attribute definitions
 * @param usage - The intended usage (prompt_injection, etc.)
 */
export function getAttributesForUsage(
	allAttributes: ResolvedAttributes,
	attributeDefinitions: AttributeDefinition[],
	usage: AttributeUsage
): ResolvedAttributes {
	const filtered: ResolvedAttributes = {};

	for (const def of attributeDefinitions) {
		const key = def.attribute_key;

		if (def.allowed_usages.includes(usage)) {
			filtered[key] = allAttributes[key];
		}
	}

	return filtered;
}

// ============================================================================
// High-Level Convenience Functions
// ============================================================================

/**
 * Resolve and return all attributes for a user, loading definitions
 * This is the main entry point for agent.ts
 *
 * IMPORTANT: User facts must be loaded from the graph before calling this.
 * There is NO database table for user facts - they live in the graph.
 *
 * @param db - Database client (for loading attribute definitions only)
 * @param userId - User ID
 * @param cfHeaders - CF headers from request (lowercase keys)
 * @param userFacts - User facts from the graph (REQUIRED)
 */
export async function resolveAllAttributes(
	db: Database,
	userId: string,
	cfHeaders: Record<string, string> = {},
	userFacts: GraphNode[] = [],
	profileNodes: GraphNode[] = []
): Promise<{ attributes: ResolvedAttributes; definitions: AttributeDefinition[] }> {
	// Load attribute definitions (cached)
	const definitions = await loadAttributeDefinitions(db);

	// Create context from headers
	const ctx = createContextFromHeaders(cfHeaders);

	// Resolve all attributes using the provided facts from Graph DO
	const attributes = resolveAttributes(ctx, userId, userFacts, definitions, profileNodes);

	return { attributes, definitions };
}

/**
 * Filter resolved attributes for a specific usage
 * Convenience function that handles loading definitions if not provided
 */
export async function filterAttributesForUsage(
	db: Database,
	allAttributes: ResolvedAttributes,
	usage: AttributeUsage,
	definitions?: AttributeDefinition[]
): Promise<Record<string, string>> {
	const defs = definitions ?? (await loadAttributeDefinitions(db));
	const filtered = getAttributesForUsage(allAttributes, defs, usage);

	// Convert to string values for prompt injection
	const stringified: Record<string, string> = {};
	for (const [key, value] of Object.entries(filtered)) {
		if (value !== undefined && value !== null) {
			stringified[key] = String(value);
		}
	}

	return stringified;
}
