const {
  setSession,
  clearSession
} = require('../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'DELETE') {
    clearSession(res);

    return res.status(200).json({
      success: true
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  const {
    username,
    password
  } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({
      error: 'Username and password are required'
    });
  }

  const passwords = {
    shiryu: process.env.SHIRYU_ADMIN_PASSWORD,
    allchemi: process.env.ALLCHEMI_ADMIN_PASSWORD
  };

  if (!passwords[username]) {
    return res.status(401).json({
      error: 'Invalid credentials'
    });
  }

  if (password !== passwords[username]) {
    return res.status(401).json({
      error: 'Invalid credentials'
    });
  }

  setSession(res, username);

  return res.status(200).json({
    success: true,
    owner: username
  });
};