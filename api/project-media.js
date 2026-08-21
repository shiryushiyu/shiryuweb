const { get } = require('@vercel/blob');
const { getPool, ensureSchema } = require('../lib/db');

const VALID_OWNERS = ['shiryu', 'allchemi'];

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);

    return res.status(405).json({
      error: `Method ${req.method} not allowed`,
    });
  }

  const owner = String(req.query.owner || '');
  const pathname = String(req.query.pathname || '');

  if (!VALID_OWNERS.includes(owner)) {
    return res.status(400).json({
      error: 'Invalid owner',
    });
  }

  if (!pathname) {
    return res.status(400).json({
      error: 'Missing pathname',
    });
  }

  if (!pathname.startsWith(`media/${owner}/`)) {
    return res.status(403).json({
      error: 'Forbidden',
    });
  }

  try {
    await ensureSchema(owner);

    const pool = getPool(owner);

    const projectResult = await pool.query(
      `
      SELECT id
      FROM projects
      WHERE owner = $1
        AND media_path = $2
      LIMIT 1
      `,
      [owner, pathname]
    );

    if (projectResult.rowCount === 0) {
      return res.status(404).json({
        error: 'Media not found',
      });
    }

    const result = await get(pathname, {
      access: 'private',
      ifNoneMatch:
        req.headers['if-none-match'] || undefined,
    });

    if (!result) {
      return res.status(404).end();
    }

    if (result.statusCode === 304) {
      if (result.blob?.etag) {
        res.setHeader('ETag', result.blob.etag);
      }

      res.setHeader(
        'Cache-Control',
        'private, no-cache'
      );

      return res.status(304).end();
    }

    if (result.statusCode !== 200 || !result.stream) {
      return res.status(404).end();
    }

    res.statusCode = 200;

    res.setHeader(
      'Content-Type',
      result.blob.contentType ||
        'application/octet-stream'
    );

    res.setHeader(
      'X-Content-Type-Options',
      'nosniff'
    );

    res.setHeader(
      'Cache-Control',
      'private, no-cache'
    );

    if (result.blob.etag) {
      res.setHeader(
        'ETag',
        result.blob.etag
      );
    }

    const reader = result.stream.getReader();

    try {
      while (true) {
        const { done, value } =
          await reader.read();

        if (done) break;

        res.write(Buffer.from(value));
      }
    } finally {
      reader.releaseLock();
    }

    return res.end();
  } catch (err) {
    console.error(
      'GET /api/project-media error:',
      err
    );

    return res.status(500).json({
      error:
        err.message ||
        'Failed to load project media',
    });
  }
};