import pg from 'pg';
import { runDatabaseMigrations } from './database-migrations.js';
const connectionString = process.env.DATABASE_MIGRATION_URL;
if (!connectionString) {
    console.error('DATABASE_MIGRATION_URL is required.');
    process.exit(1);
}
const pool = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 10_000 });
try {
    await runDatabaseMigrations(pool);
    console.log('CloudCore database migrations completed.');
}
catch {
    console.error('CloudCore database migrations failed.');
    process.exitCode = 1;
}
finally {
    await pool.end();
}
