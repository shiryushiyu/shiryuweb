const { rateLimit, getClientIp } = require('../lib/rateLimit');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clientIp = getClientIp(req);
  const rateCheck = rateLimit(clientIp, 3, 20 * 60 * 1000, 5 * 60 * 1000);
  
  if (!rateCheck.allowed) {
    res.setHeader('Retry-After', Math.ceil(rateCheck.retryAfter / 1000));
    return res.status(429).json({ 
      error: rateCheck.reason,
      retryAfter: Math.ceil(rateCheck.retryAfter / 1000)
    });
  }

  try {
    let body = req.body;
    
    if (typeof body === 'string') {
      body = JSON.parse(body);
    }

    const { name, message } = body;

    if (!name || !message) {
      return res.status(400).json({ error: 'Name and message are required' });
    }

    if (name.length > 100) {
      return res.status(400).json({ error: 'Name is too long (max 100 characters)' });
    }

    if (message.length > 2000) {
      return res.status(400).json({ error: 'Message is too long (max 2000 characters)' });
    }

    const sanitizedName = name.replace(/[<>]/g, '');
    const sanitizedMessage = message.replace(/[<>]/g, '');

    await sendDiscordDM(sanitizedName, sanitizedMessage);

    return res.status(200).json({ 
      success: true, 
      message: 'Message received successfully'
    });
  } catch (err) {
    console.error('Contact error:', err);
    return res.status(500).json({ error: 'Failed to process message: ' + err.message });
  }
};

async function sendDiscordDM(name, message) {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const userId = process.env.DISCORD_USER_ID;
  
  console.log('Bot token exists:', !!botToken);
  console.log('User ID exists:', !!userId);
  
  if (!botToken || !userId) {
    console.log('Discord bot not configured');
    return;
  }

  try {
    console.log('Creating DM channel...');
    
    const dmResponse = await fetch('https://discord.com/api/v10/users/@me/channels', {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recipient_id: userId
      })
    });

    console.log('DM channel response:', dmResponse.status);
    
    if (!dmResponse.ok) {
      const errorText = await dmResponse.text();
      console.error('Failed to create DM channel:', errorText);
      throw new Error(`Failed to create DM channel: ${dmResponse.status}`);
    }

    const dmChannel = await dmResponse.json();
    console.log('DM channel created:', dmChannel.id);

    console.log('Sending message...');
    
    const messageResponse = await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: `**New Contact Message**\n\n**From:** ${name}\n**Time:** ${new Date().toLocaleString()}\n\n**Message:**\n${message}`
      })
    });

    console.log('Message response:', messageResponse.status);
    
    if (!messageResponse.ok) {
      const errorText = await messageResponse.text();
      console.error('Failed to send DM:', errorText);
      throw new Error(`Failed to send DM: ${messageResponse.status}`);
    }

    console.log('Discord DM sent successfully');
  } catch (err) {
    console.error('Error sending Discord DM:', err);
  }
}