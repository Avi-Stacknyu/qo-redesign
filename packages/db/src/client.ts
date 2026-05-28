import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Client, Pool } from 'pg';
import * as schema from './schema/index';

export type Database = NodePgDatabase<typeof schema>;
export type { Client } from 'pg';

const pools = new Map<string, Pool>();

function getPool(connectionString: string): Pool {
  let pool = pools.get(connectionString);
  if (!pool) {
    pool = new Pool({ connectionString, max: 1 });
    pools.set(connectionString, pool);
  }
  return pool;
}

export function createDb(connectionString: string): Database {
  return drizzle(getPool(connectionString), { schema });
}

export function createDbUncached(connectionString: string): Database {
  const pool = new Pool({ connectionString, max: 1 });
  return drizzle(pool, { schema });
}

/**
 * Create a Drizzle DB instance using pg.Client per Cloudflare Hyperdrive docs.
 * Returns both the db and the underlying client so callers can call client.end().
 */
export async function createDbHyperdrive(
  connectionString: string
): Promise<{ db: Database; client: Client }> {
  const client = new Client({ connectionString });
  await client.connect();
  return { db: drizzle(client, { schema }), client };
}

export async function withUserDb<T>(
  db: Database,
  userId: string,
  fn: (tx: Database) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      `SELECT set_config('app.current_user_id', '${userId.replace(/'/g, "''")}', true)`
    );
    return fn(tx as unknown as Database);
  });
}

export async function withServiceDb<T>(db: Database, fn: (db: Database) => Promise<T>): Promise<T> {
  return fn(db);
}
