const { getPool } = require('../lib/db');

function getHost(connectionString) {
  try {
    return new URL(connectionString).hostname;
  } catch {
    return 'invalid';
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).end();
  }

  const key = req.headers['x-db-check-key'];

  if (!process.env.DB_CHECK_KEY || key !== process.env.DB_CHECK_KEY) {
    return res.status(401).json({
      error: 'Unauthorized'
    });
  }

  try {
    const result = {};

    for (const owner of ['shiryu', 'allchemi']) {
      const pool = getPool(owner);

      const projects = await pool.query(`
        SELECT
          id,
          owner,
          title,
          media_type,
          media_path,
          thumbnail_path,
          created_at
        FROM projects
        ORDER BY id ASC
      `);

      result[owner] = {
        connectionHost:
          owner === 'shiryu'
            ? getHost(process.env.POSTGRES_URL)
            : getHost(process.env.ALLCHEMI_POSTGRES_URL),
        projects: projects.rows
      };
    }

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({
      error: err.message
    });
  }
};