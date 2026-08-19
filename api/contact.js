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

  try {
    let body = req.body;
    
    if (typeof body === 'string') {
      body = JSON.parse(body);
    }

    const { name, message } = body;

    if (!name || !message) {
      return res.status(400).json({ error: 'Name and message are required' });
    }

    console.log('Message received:', { name, message });

    return res.status(200).json({ 
      success: true, 
      message: 'Message received successfully' 
    });
  } catch (err) {
    console.error('Contact error:', err);
    return res.status(500).json({ error: 'Failed to process message: ' + err.message });
  }
};