const { formidable } = require('formidable');
const fs = require('fs');
const { put } = require('@vercel/blob');
const { getDb } = require('../../lib/db');
const { requireAuth } = require('../../lib/auth');

const VALID_OWNERS = ['shiryu', 'allchemi'];

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({
      multiples: false,
      keepExtensions: true
    });

    form.parse(req, (err, fields, files) => {
      if (err) {
        reject(err);
        return;
      }

      resolve({ fields, files });
    });
  });
}

function getField(fields, name) {
  const value = fields[name];

  if (Array.isArray(value)) {
    return value[0] || '';
  }

  return value || '';
}

function getFile(files, name) {
  const value = files[name];

  if (Array.isArray(value)) {
    return value[0] || null;
  }

  return value || null;
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const owner = String(req.query.owner || '');

    if (!VALID_OWNERS.includes(owner)) {
      return res.status(400).json({
        error: 'Invalid owner'
      });
    }

    try {
      const db = getDb(owner);

      const result = await db.query(
        `
        SELECT
          id,
          title,
          description,
          tags,
          media_path,
          media_type,
          featured,
          created_at
        FROM projects
        WHERE owner = $1
        ORDER BY created_at DESC
        `,
        [owner]
      );

      return res.status(200).json(result.rows);
    } catch (error) {
      console.error('GET /api/projects error:', error);

      return res.status(500).json({
        error: 'Failed to load projects'
      });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  const session = requireAuth(req, res);

  if (!session) {
    return;
  }

  const owner = session.owner;

  if (!VALID_OWNERS.includes(owner)) {
    return res.status(403).json({
      error: 'Forbidden'
    });
  }

  try {
    const {
      fields,
      files
    } = await parseForm(req);

    const title = getField(fields, 'title').trim();
    const description = getField(fields, 'description').trim();
    const tags = getField(fields, 'tags').trim();
    const youtubeUrl = getField(fields, 'youtube_url').trim();
    const featured = getField(fields, 'featured') === '1';

    if (!title) {
      return res.status(400).json({
        error: 'Title is required'
      });
    }

    const mediaFile = getFile(files, 'media');

    let mediaPath = null;
    let mediaType = null;

    if (mediaFile) {
      const filePath =
        mediaFile.filepath ||
        mediaFile.path;

      if (!filePath) {
        return res.status(400).json({
          error: 'Invalid uploaded file'
        });
      }

      const fileName =
        mediaFile.originalFilename ||
        mediaFile.newFilename ||
        'upload';

      const contentType =
        mediaFile.mimetype ||
        'application/octet-stream';

      const buffer =
        await fs.promises.readFile(filePath);

      const blob = await put(
        `projects/${owner}/${Date.now()}-${fileName}`,
        buffer,
        {
          access: 'public',
          contentType
        }
      );

      mediaPath = blob.url;

      if (contentType.startsWith('video/')) {
        mediaType = 'video';
      } else if (contentType.startsWith('image/')) {
        mediaType = 'image';
      } else {
        mediaType = 'file';
      }

      try {
        await fs.promises.unlink(filePath);
      } catch {}
    } else if (youtubeUrl) {
      const match = youtubeUrl.match(
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/
      );

      if (!match) {
        return res.status(400).json({
          error: 'Invalid YouTube URL'
        });
      }

      mediaPath = match[1];
      mediaType = 'youtube';
    }

    if (!mediaPath) {
      return res.status(400).json({
        error: 'A media file or YouTube URL is required'
      });
    }

    const db = getDb(owner);

    const result = await db.query(
      `
      INSERT INTO projects (
        owner,
        title,
        description,
        tags,
        media_path,
        media_type,
        featured
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING
        id,
        owner,
        title,
        description,
        tags,
        media_path,
        media_type,
        featured,
        created_at
      `,
      [
        owner,
        title,
        description,
        tags,
        mediaPath,
        mediaType,
        featured
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('POST /api/projects error:', error);

    return res.status(500).json({
      error: error.message || 'Failed to create project'
    });
  }
};