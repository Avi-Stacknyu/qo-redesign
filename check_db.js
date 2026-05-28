const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
async function run() {
  try {
    await client.connect();
    const colRes = await client.query("SELECT column_name, column_default FROM information_schema.columns WHERE table_name = 'config_onboarding_profiles' AND column_name IN ('default_tags', 'visibility');");
    console.log('Columns found:', colRes.rows);
    const migRes = await client.query("SELECT * FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1;");
    console.log('Latest migration:', migRes.rows[0]);
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}
run();
