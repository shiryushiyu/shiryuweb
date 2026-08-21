const { getSession } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  const session = getSession(req);

  if (!session) {
    return res.status(401).json({
      authenticated: false
    });
  }

  return res.status(200).json({
    authenticated: true,
    owner: session.owner
  });
};