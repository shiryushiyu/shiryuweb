const { Pool } = require('pg');

if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL is not set. Add it in your .env (local) or Vercel project env vars.');
}

// Two fully separate databases: shiryu's (POSTGRES_URL) and allchemi's (ALLCHEMI_POSTGRES_URL).
// If ALLCHEMI_POSTGRES_URL isn't set yet, allchemi's requests fall back to the shared one
// (not ideal, but keeps things working while you're setting the new DB up).
const pools = {
  shiryu: new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
  }),
  allchemi: new Pool({
    connectionString: process.env.ALLCHEMI_POSTGRES_URL || process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
  })
};

function getPool(owner) {
  return pools[owner] || pools.shiryu;
}

const initialized = { shiryu: false, allchemi: false };

async function ensureSchema(owner = 'shiryu') {
  const key = pools[owner] ? owner : 'shiryu';
  if (initialized[key]) return;
  const pool = pools[key];

  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      owner TEXT NOT NULL DEFAULT 'shiryu',
      title TEXT NOT NULL,
      description TEXT,
      tags TEXT,
      media_type TEXT NOT NULL,
      media_path TEXT NOT NULL,
      thumbnail_path TEXT,
      featured INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      owner TEXT NOT NULL DEFAULT 'shiryu',
      name TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  // Migrations for pre-existing tables from earlier schema versions
  await pool.query(`ALTER TABLE messages DROP COLUMN IF EXISTS email;`);
  await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner TEXT NOT NULL DEFAULT 'shiryu';`);
  await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS owner TEXT NOT NULL DEFAULT 'shiryu';`);

  initialized[key] = true;
}

module.exports = { getPool, ensureSchema };
