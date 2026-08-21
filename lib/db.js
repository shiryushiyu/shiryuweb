const { Pool } = require('pg');

if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL is not configured');
}

if (!process.env.ALLCHEMI_POSTGRES_URL) {
  throw new Error('ALLCHEMI_POSTGRES_URL is not configured');
}

const pools = {
  shiryu: new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
  }),

  allchemi: new Pool({
    connectionString: process.env.ALLCHEMI_POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
  })
};

function getPool(owner) {
  if (owner !== 'shiryu' && owner !== 'allchemi') {
    throw new Error(`Unknown database owner: ${owner}`);
  }

  return pools[owner];
}

const initialized = {
  shiryu: false,
  allchemi: false
};

async function ensureSchema(owner) {
  const pool = getPool(owner);

  if (initialized[owner]) {
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      owner TEXT NOT NULL DEFAULT '${owner}',
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      tags TEXT DEFAULT '',
      media_type TEXT NOT NULL,
      media_path TEXT NOT NULL,
      thumbnail_path TEXT,
      featured INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      owner TEXT NOT NULL DEFAULT '${owner}',
      name TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    ALTER TABLE messages DROP COLUMN IF EXISTS email
  `);

  await pool.query(`
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner TEXT NOT NULL DEFAULT '${owner}'
  `);

  await pool.query(`
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS owner TEXT NOT NULL DEFAULT '${owner}'
  `);

  initialized[owner] = true;
}

module.exports = {
  getPool,
  ensureSchema
};