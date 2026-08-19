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

    await sendDiscordNotification(sanitizedName, sanitizedMessage, clientIp);

    return res.status(200).json({ 
      success: true, 
      message: 'Message received successfully'
    });
  } catch (err) {
    console.error('Contact error:', err);
    return res.status(500).json({ error: 'Failed to process message: ' + err.message });
  }
};

async function sendDiscordNotification(name, message, ip) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.log('Discord webhook not configured');
    return;
  }

  try {
    const embed = {
      title: '📬 New Contact Message',
      color: 0x28e2ff,
      fields: [
        {
          name: 'From',
          value: name,
          inline: true
        },
        {
          name: 'IP Address',
          value: ip || 'Unknown',
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
      footer: {
        text: 'Shiryu Portfolio Contact Form'
      },
      timestamp: new Date().toISOString()
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        embeds: [embed]
      })
    });

    if (!response.ok) {
      console.error('Discord webhook failed:', response.status);
    }
  } catch (err) {
    console.error('Error sending Discord notification:', err);
  }
}