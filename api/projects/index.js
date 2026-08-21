const { formidable } = require('formidable');
const fs = require('fs');
const { put } = require('@vercel/blob');
const { getPool, ensureSchema } = require('../../lib/db');
const { requireAuth } = require('../../lib/auth');

const VALID_OWNERS = ['shiryu', 'allchemi'];

const ALLOWED_EXT = /\.(jpe?g|png|gif|webp|mp4|webm|mov)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov)$/i;

function extractYouTubeId(url) {
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/
  );

  return match ? match[1] : null;
}

function getField(fields, name, fallback = '') {
  const value = fields[name];

  if (Array.isArray(value)) {
    return value[0] || fallback;
  }

  return value || fallback;
}

function getFile(files, name) {
  const value = files[name];

  if (Array.isArray(value)) {
    return value[0] || null;
  }

  return value || null;
}

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({
      maxFileSize: 100 * 1024 * 1024,
      multiples: false,
      keepExtensions: true
    });

    form.parse(req, (err, fields, files) => {
      if (err) {
        reject(err);
        return;
      }

      resolve({
        fields,
        files
      });
    });
  });
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
      await ensureSchema(owner);

      const pool = getPool(owner);

      const featured = req.query.featured;

      const result =
        featured === '1'
          ? await pool.query(
              `
              SELECT *
              FROM projects
              WHERE owner = $1
              AND featured = 1
              ORDER BY sort_order ASC, id DESC
              `,
              [owner]
            )
          : await pool.query(
              `
              SELECT *
              FROM projects
              WHERE owner = $1
              ORDER BY sort_order ASC, id DESC
              `,
              [owner]
            );

      return res.status(200).json(result.rows);
    } catch (err) {
      console.error('GET /api/projects error:', err);

      return res.status(500).json({
        error: err.message || 'Failed to load projects'
      });
    }
  }

  if (req.method === 'POST') {
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

      const featured = Number(
        getField(fields, 'featured', '0')
      );

      const sort_order = Number(
        getField(fields, 'sort_order', '0')
      );

      if (!title) {
        return res.status(400).json({
          error: 'title is required'
        });
      }

      await ensureSchema(owner);

      const pool = getPool(owner);

      const mediaFile = getFile(files, 'media');

      let media_type;
      let media_path;

      if (youtubeUrl) {
        const videoId = extractYouTubeId(youtubeUrl);

        if (!videoId) {
          return res.status(400).json({
            error: 'Could not parse a YouTube video ID from that URL'
          });
        }

        media_type = 'youtube';
        media_path = videoId;
      } else if (mediaFile) {
        const filename =
          mediaFile.originalFilename || '';

        if (!ALLOWED_EXT.test(filename)) {
          return res.status(400).json({
            error: 'Unsupported file type'
          });
        }

        media_type =
          VIDEO_EXT.test(filename)
            ? 'video'
            : 'image';

        const filePath =
          mediaFile.filepath ||
          mediaFile.path;

        if (!filePath) {
          return res.status(400).json({
            error: 'Invalid uploaded file'
          });
        }

        const buffer =
          await fs.promises.readFile(filePath);

        const blob = await put(
          `media/${Date.now()}-${filename}`,
          buffer,
          {
            access: 'public',
            contentType:
              mediaFile.mimetype ||
              'application/octet-stream'
          }
        );

        media_path = blob.url;

        try {
          await fs.promises.unlink(filePath);
        } catch {}
      } else {
        return res.status(400).json({
          error: 'Provide either a media file or a YouTube URL'
        });
      }

      let thumbnail_path = null;

      const thumbFile =
        getFile(files, 'thumbnail');

      if (thumbFile) {
        const thumbPath =
          thumbFile.filepath ||
          thumbFile.path;

        if (thumbPath) {
          const thumbBuffer =
            await fs.promises.readFile(
              thumbPath
            );

          const thumbBlob = await put(
            `media/thumb-${Date.now()}-${thumbFile.originalFilename || 'thumbnail'}`,
            thumbBuffer,
            {
              access: 'public',
              contentType:
                thumbFile.mimetype ||
                'application/octet-stream'
            }
          );

          thumbnail_path =
            thumbBlob.url;

          try {
            await fs.promises.unlink(
              thumbPath
            );
          } catch {}
        }
      }

      const result = await pool.query(
        `
        INSERT INTO projects (
          owner,
          title,
          description,
          tags,
          media_type,
          media_path,
          thumbnail_path,
          featured,
          sort_order
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9
        )
        RETURNING *
        `,
        [
          owner,
          title,
          description,
          tags,
          media_type,
          media_path,
          thumbnail_path,
          featured,
          sort_order
        ]
      );

      return res.status(201).json(
        result.rows[0]
      );
    } catch (err) {
      console.error(
        'POST /api/projects error:',
        err
      );

      return res.status(500).json({
        error:
          err.message ||
          'Failed to create project'
      });
    }
  }

  res.setHeader(
    'Allow',
    ['GET', 'POST', 'OPTIONS']
  );

  return res.status(405).json({
    error:
      `Method ${req.method} not allowed`
  });
};

module.exports.config = {
  api: {
    bodyParser: false
  }
};