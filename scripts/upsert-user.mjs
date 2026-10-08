import pg from 'pg';
import { randomUUID } from 'node:crypto';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const q = await pool.query(`
    INSERT INTO users(id, tenant_id, object_id, email, display_name, role)
    VALUES($1, $2, $3, $4, $5, $6)
    ON CONFLICT(tenant_id, object_id) DO UPDATE
      SET email=EXCLUDED.email, display_name=EXCLUDED.display_name, role=EXCLUDED.role, updated_at=now()
    RETURNING *
  `, [randomUUID(), 'development', 'azeemniazi', 'azeemniazi@cloudcore.local', 'Azeem Niazi', 'admin']);
  console.log('SUCCESSFULLY CREATED USER IN SUPABASE:');
  console.log(q.rows[0]);
} catch (err) {
  console.error('ERROR:', err);
} finally {
  await pool.end();
}
