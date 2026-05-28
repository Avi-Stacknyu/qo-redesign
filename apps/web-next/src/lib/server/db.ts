import { createDbHyperdrive, type Client, type Database } from '@repo/db/client';

export async function getDb(platform: App.Platform): Promise<{ db: Database; client: Client }> {
	return createDbHyperdrive(platform.env.HYPERDRIVE.connectionString);
}
