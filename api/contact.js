const { pool, ensureSchema } = require('../lib/db');
const { setCors } = require('../lib/cors');

module.exports = async function handler(req, res) {
  setCors(res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  await ensureSchema();

  if (req.method === 'POST') {
    try {
      const { name, message } = req.body;

      if (!name || !message) {
        return res.status(400).json({ error: 'Name and message are required' });
      }

      const { rows } = await pool.query(
        `INSERT INTO messages (name, message)
         VALUES ($1, $2)
         RETURNING *`,
        [name, message]
      );

      return res.status(201).json({ 
        success: true, 
        message: 'Message sent successfully',
        data: rows[0]
      });
    } catch (err) {
      console.error('Error saving message:', err);
      return res.status(500).json({ error: 'Failed to send message' });
    }
  }

  if (req.method === 'GET') {
    try {
      const { rows } = await pool.query(
        'SELECT * FROM messages ORDER BY created_at DESC'
      );
      return res.status(200).json(rows);
    } catch (err) {
      console.error('Error fetching messages:', err);
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST', 'OPTIONS']);
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
};