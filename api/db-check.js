const { getPool } = require('../lib/db');

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

      const db = await pool.query(`
        SELECT
          current_database() AS database,
          current_schema() AS schema,
          current_user AS user,
          inet_server_addr() AS server,
          inet_server_port() AS port
      `);

      const projects = await pool.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE owner = $1)::int AS owner_rows
        FROM projects
      `, [owner]);

      result[owner] = {
        database: db.rows[0].database,
        schema: db.rows[0].schema,
        user: db.rows[0].user,
        server: db.rows[0].server,
        port: db.rows[0].port,
        projects: projects.rows[0]
      };
    }

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({
      error: err.message
    });
  }
};