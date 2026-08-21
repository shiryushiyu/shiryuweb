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
  if (owner === 'shiryu') {
    return pools.shiryu;
  }

  if (owner === 'allchemi') {
    return pools.allchemi;
  }

  throw new Error(`Unknown database owner: ${owner}`);
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
      owner TEXT NOT NULL,
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
    CREATE INDEX IF NOT EXISTS projects_owner_idx
    ON projects(owner)
  `);

  initialized[owner] = true;
}

module.exports = {
  getPool,
  ensureSchema
};