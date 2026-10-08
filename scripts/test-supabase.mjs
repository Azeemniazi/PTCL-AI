import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const info = await pool.query('SELECT current_database() as db, current_user as usr, now() as db_time, version() as pg_version');
  const tables = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
  console.log('STATUS: CONNECTED');
  console.log('DATABASE:', info.rows[0].db);
  console.log('USER:', info.rows[0].usr);
  console.log('DB TIME (UTC):', info.rows[0].db_time);
  console.log('POSTGRES VERSION:', info.rows[0].pg_version.split(' on ')[0]);
  console.log('ACTIVE TABLES IN SUPABASE:');
  for (const t of tables.rows) {
    const count = await pool.query(`SELECT count(*)::int as count FROM "${t.tablename}"`);
    console.log(`  - ${t.tablename} (${count.rows[0].count} rows)`);
  }
} catch (err) {
  console.error('STATUS: FAILED', err.message);
} finally {
  await pool.end();
}
