const crypto = require('crypto');

const COOKIE_NAME = 'admin_session';
const MAX_AGE = 60 * 60 * 24 * 7;

function getSecret() {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error('AUTH_SECRET is not configured');
  }

  return secret;
}

function sign(value) {
  return crypto
    .createHmac('sha256', getSecret())
    .update(value)
    .digest('base64url');
}

function createToken(owner) {
  const payload = Buffer.from(
    JSON.stringify({
      owner,
      exp: Math.floor(Date.now() / 1000) + MAX_AGE
    })
  ).toString('base64url');

  return `${payload}.${sign(payload)}`;
}

function verifyToken(token) {
  if (!token) return null;

  const parts = token.split('.');

  if (parts.length !== 2) {
    return null;
  }

  const [payload, signature] = parts;
  const expected = sign(payload);

  if (
    signature.length !== expected.length ||
    !crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    )
  ) {
    return null;
  }

  try {
    const data = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    );

    if (!['shiryu', 'allchemi'].includes(data.owner)) {
      return null;
    }

    if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

function getCookies(req) {
  const header = req.headers.cookie || '';
  const cookies = {};

  for (const part of header.split(';')) {
    const index = part.indexOf('=');

    if (index === -1) {
      continue;
    }

    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();

    cookies[key] = decodeURIComponent(value);
  }

  return cookies;
}

function getSession(req) {
  const cookies = getCookies(req);

  return verifyToken(cookies[COOKIE_NAME]);
}

function setSession(res, owner) {
  const token = createToken(owner);

  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${MAX_AGE}`
  );
}

function clearSession(res) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
  );
}

function requireAuth(req, res, owner = null) {
  const session = getSession(req);

  if (!session) {
    res.status(401).json({
      error: 'Authentication required'
    });

    return null;
  }

  if (owner && session.owner !== owner) {
    res.status(403).json({
      error: 'Forbidden'
    });

    return null;
  }

  return session;
}

module.exports = {
  getSession,
  setSession,
  clearSession,
  requireAuth
};