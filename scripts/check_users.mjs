import pg from 'pg';
import { hashPassword } from '../build/crypto.js';
import { config } from '../build/config.js';

console.log('Testing password verification:');
console.log('config.initialDevPassword:', config.initialDevPassword);
console.log('config.initialAdminPassword:', config.initialAdminPassword);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const res = await pool.query('SELECT username, role FROM users');
console.log('DB Users:', res.rows);
await pool.end();
