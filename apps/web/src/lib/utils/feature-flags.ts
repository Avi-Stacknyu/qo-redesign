/**
 * Feature Flags — resolves which feature flags are enabled for a user via CF Worker RPC.
 * Falls back to empty result when worker is unavailable (local dev).
 */

/** Call CF_WORKER.getEnabledFeatures RPC to get enabled flag keys. */
export async function getEnabledFeaturesFromWorker(
	platform: App.Platform | undefined,
	userId: string
): Promise<string[]> {
	const worker = platform?.env?.CF_WORKER;
	if (!worker) return [];

	try {
		const result = await worker.getEnabledFeatures({ userId });
		return result.features;
	} catch (err) {
		console.error('[feature-flags] RPC failed:', err);
		return [];
	}
}
