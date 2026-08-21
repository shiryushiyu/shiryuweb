const { getPool, ensureSchema } = require('../lib/db');
const { setCors } = require('../lib/cors');

const VALID_OWNERS = ['shiryu', 'allchemi'];

async function sendDiscordDM(userId, name, message, owner) {
  const token = process.env.DISCORD_BOT_TOKEN;

  if (!token || !userId) {
    throw new Error('Discord configuration is missing');
  }

  const channelResponse = await fetch(
    'https://discord.com/api/v10/users/@me/channels',
    {
      method: 'POST',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient_id: userId,
      }),
    }
  );

  if (!channelResponse.ok) {
    const error = await channelResponse.text();
    throw new Error(`Failed to create Discord DM channel: ${error}`);
  }

  const channel = await channelResponse.json();

  const portfolioName =
    owner === 'allchemi'
      ? 'Allchemi'
      : 'Shiryu';

  const color =
    owner === 'allchemi'
      ? 0x8B5CF6
      : 0x3B82F6;

  const messageResponse = await fetch(
    `https://discord.com/api/v10/channels/${channel.id}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embeds: [
          {
            title: `New message from ${portfolioName}`,
            color,
            fields: [
              {
                name: 'Name',
                value: name.slice(0, 1024),
                inline: false,
              },
              {
                name: 'Message',
                value: message.slice(0, 1024),
                inline: false,
              },
            ],
            footer: {
              text: `${portfolioName} Portfolio`,
            },
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    }
  );

  if (!messageResponse.ok) {
    const error = await messageResponse.text();
    throw new Error(`Failed to send Discord DM: ${error}`);
  }
}

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const owner = String(req.query.owner || 'shiryu');

    if (!VALID_OWNERS.includes(owner)) {
      return res.status(400).json({
        error: 'Invalid owner',
      });
    }

    await ensureSchema(owner);

    const pool = getPool(owner);

    const { rows } = await pool.query(
      'SELECT * FROM messages WHERE owner = $1 ORDER BY id DESC',
      [owner]
    );

    return res.status(200).json(rows);
  }

  if (req.method === 'POST') {
    const { name, message, owner } = req.body || {};

    if (!name || !message) {
      return res.status(400).json({
        error: 'name and message are required',
      });
    }

    const finalOwner = owner || 'shiryu';

    if (!VALID_OWNERS.includes(finalOwner)) {
      return res.status(400).json({
        error: 'Invalid owner',
      });
    }

    await ensureSchema(finalOwner);

    const pool = getPool(finalOwner);

    const { rows } = await pool.query(
      'INSERT INTO messages (owner, name, message) VALUES ($1,$2,$3) RETURNING id',
      [finalOwner, name, message]
    );

    const discordUserId =
      finalOwner === 'allchemi'
        ? process.env.ALLCHEMI_ID
        : process.env.SHIRYU_ID;

    try {
      await sendDiscordDM(
        discordUserId,
        name,
        message,
        finalOwner
      );
    } catch (err) {
      console.error('Discord DM error:', err);
    }

    return res.status(201).json({
      id: rows[0].id,
      success: true,
    });
  }

  res.setHeader('Allow', ['GET', 'POST', 'OPTIONS']);

  return res.status(405).json({
    error: `Method ${req.method} not allowed`,
  });
};