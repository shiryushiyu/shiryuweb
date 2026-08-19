const { pool, ensureSchema } = require('../lib/db');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  await ensureSchema();

  if (req.method === 'GET') {
    const { rows } = await pool.query(
      'SELECT * FROM messages ORDER BY created_at DESC'
    );
    return res.status(200).json(rows);
  }

  if (req.method === 'POST') {
    try {
      let body = req.body;
      
      if (typeof body === 'string') {
        body = JSON.parse(body);
      }

      const { name, message } = body;

      if (!name || !message) {
        return res.status(400).json({ error: 'Name and message are required' });
      }

      const { rows } = await pool.query(
        `INSERT INTO messages (name, message)
         VALUES ($1, $2)
         RETURNING *`,
        [name, message]
      );

      await sendDiscordDM(name, message);

      console.log('Message saved and Discord DM sent:', rows[0]);

      return res.status(200).json({ 
        success: true, 
        message: 'Message received successfully',
        data: rows[0]
      });
    } catch (err) {
      console.error('Contact error:', err);
      return res.status(500).json({ error: 'Failed to process message: ' + err.message });
    }
  }

  res.setHeader('Allow', ['GET', 'POST', 'OPTIONS']);
  return res.status(405).json({ error: 'Method not allowed' });
};

async function sendDiscordDM(name, message) {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const userId = process.env.DISCORD_USER_ID;
  
  if (!botToken || !userId) {
    console.log('Discord bot not configured, skipping DM');
    return;
  }

  try {
    const response = await fetch(`https://discord.com/api/v10/users/@me/channels`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recipient_id: userId
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to create DM channel: ${response.status}`);
    }

    const dmChannel = await response.json();

    const messageResponse = await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        embeds: [{
          title: '📬 New Contact Message',
          color: 0x28e2ff,
          fields: [
            {
              name: 'From',
              value: name,
              inline: true
            },
            {
              name: 'Time',
              value: new Date().toLocaleString(),
              inline: true
            },
            {
              name: 'Message',
              value: message.length > 1024 ? message.substring(0, 1021) + '...' : message
            }
          ],
          timestamp: new Date().toISOString()
        }]
      })
    });

    if (!messageResponse.ok) {
      throw new Error(`Failed to send DM: ${messageResponse.status}`);
    }

    console.log('Discord DM sent successfully');
  } catch (err) {
    console.error('Error sending Discord DM:', err);
  }
}