const { pool, ensureSchema } = require('../lib/db');
const { setCors } = require('../lib/cors');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  await ensureSchema();

  if (req.method === 'GET') {
    const owner = req.query.owner || 'shiryu';
    const { rows } = await pool.query('SELECT * FROM messages WHERE owner = $1 ORDER BY id DESC', [owner]);
    return res.status(200).json(rows);
  }

  if (req.method === 'POST') {
    const { name, message, owner } = req.body || {};
    if (!name || !message) {
      return res.status(400).json({ error: 'name and message are required' });
    }
    const { rows } = await pool.query(
      'INSERT INTO messages (owner, name, message) VALUES ($1,$2,$3) RETURNING id',
      [owner || 'shiryu', name, message]
    );
    return res.status(201).json({ id: rows[0].id, success: true });
  }

  res.setHeader('Allow', ['GET', 'POST', 'OPTIONS']);
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
};
