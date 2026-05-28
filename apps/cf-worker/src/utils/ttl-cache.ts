/**
 * TTL Cache Utilities
 *
 * Generic cache factories with time-based expiration.
 * Used by prompts, attribute-resolver, billing pricing, etc.
 */

interface CacheEntry<T> {
	data: T;
	ts: number;
}

/** Single-value cache with TTL expiration */
export function createTTLCache<T>(ttlMs: number) {
	let entry: CacheEntry<T> | null = null;

	return {
		get(): T | null {
			if (entry && Date.now() - entry.ts < ttlMs) return entry.data;
			return null;
		},
		set(data: T): void {
			entry = { data, ts: Date.now() };
		},
		clear(): void {
			entry = null;
		}
	};
}

/** Keyed cache where each key has its own TTL expiration */
export function createKeyedTTLCache<T>(ttlMs: number) {
	const entries = new Map<string, CacheEntry<T>>();

	return {
		get(key: string): T | undefined {
			const entry = entries.get(key);
			if (entry && Date.now() - entry.ts < ttlMs) return entry.data;
			return undefined;
		},
		set(key: string, data: T): void {
			entries.set(key, { data, ts: Date.now() });
		},
		clear(): void {
			entries.clear();
		}
	};
}
