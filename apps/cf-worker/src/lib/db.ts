import { createDbHyperdrive, type Database } from '@repo/db/client';

/**
 * Create a Drizzle DB instance for the CF Worker.
 *
 * Uses pg.Client (not Pool) per Cloudflare's official Hyperdrive docs.
 * Client.connect() is awaited before drizzle sees it.
 * Hyperdrive handles TCP connection pooling at the proxy level.
 */
export async function getDb(env: { HYPERDRIVE: Hyperdrive }): Promise<Database> {
	const { db } = await createDbHyperdrive(env.HYPERDRIVE.connectionString);
	return db;
}
