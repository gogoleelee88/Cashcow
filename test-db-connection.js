// Quick database connection test
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'characterverse',
  user: 'characterverse',
  password: 'dexWxz44gCTOnpQZc0prIWjpgVu01eNi',
});

async function test() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT version()');
    console.log('✅ Connection successful!');
    console.log('PostgreSQL version:', result.rows[0].version);
    client.release();
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    process.exit(1);
  }
}

test();
