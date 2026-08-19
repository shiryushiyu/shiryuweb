const { pool, ensureSchema } = require('../lib/db');
const { setCors } = require('../lib/cors');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  await ensureSchema();

  if (req.method === 'GET') {
    const { rows } = await pool.query('SELECT * FROM messages ORDER BY id DESC');
    return res.status(200).json(rows);
  }

  if (req.method === 'POST') {
    const { name, email, message } = req.body || {};
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'name, email, and message are required' });
    }
    const { rows } = await pool.query(
      'INSERT INTO messages (name, email, message) VALUES ($1,$2,$3) RETURNING id',
      [name, email, message]
    );
    return res.status(201).json({ id: rows[0].id, success: true });
  }

  res.setHeader('Allow', ['GET', 'POST', 'OPTIONS']);
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
};
