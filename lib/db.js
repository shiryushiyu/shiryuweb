const { Pool } = require('pg');

if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL is not configured');
}

if (!process.env.ALLCHEMI_POSTGRES_URL) {
  throw new Error('ALLCHEMI_POSTGRES_URL is not configured');
}

const pools = {
  shiryu: new Pool({
    connectionString: process.env.POSTGRES_URL
  }),

  allchemi: new Pool({
    connectionString: process.env.ALLCHEMI_POSTGRES_URL
  })
};

function getPool(owner) {
  if (owner !== 'shiryu' && owner !== 'allchemi') {
    throw new Error(`Unknown database owner: ${owner}`);
  }

  return pools[owner];
}

async function ensureSchema(owner) {
  const pool = getPool(owner);

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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS projects_owner_idx
    ON projects(owner)
  `);
}

async function getDatabaseInfo(owner) {
  const pool = getPool(owner);

  const { rows } = await pool.query(`
    SELECT
      current_database() AS database,
      current_schema() AS schema
  `);

  return rows[0];
}

module.exports = {
  getPool,
  ensureSchema,
  getDatabaseInfo
};