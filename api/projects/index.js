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

function hasFile(file) {
  if (!file) {
    return false;
  }

  const filepath =
    file.filepath ||
    file.path;

  const size =
    Number(file.size) || 0;

  return Boolean(filepath && size > 0);
}

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({
      maxFileSize: 100 * 1024 * 1024,
      multiples: false,
      keepExtensions: true,
      allowEmptyFiles: true,
      minFileSize: 0
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
      console.error(
        'GET /api/projects error:',
        err
      );

      return res.status(500).json({
        error:
          err.message ||
          'Failed to load projects'
      });
    }
  }

  if (req.method !== 'POST') {
    res.setHeader(
      'Allow',
      ['GET', 'POST', 'OPTIONS']
    );

    return res.status(405).json({
      error:
        `Method ${req.method} not allowed`
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

    const title =
      getField(fields, 'title').trim();

    const description =
      getField(fields, 'description').trim();

    const tags =
      getField(fields, 'tags').trim();

    const youtubeUrl =
      getField(fields, 'youtube_url').trim();

    const featured =
      Number(
        getField(
          fields,
          'featured',
          '0'
        )
      ) || 0;

    const sort_order =
      Number(
        getField(
          fields,
          'sort_order',
          '0'
        )
      ) || 0;

    if (!title) {
      return res.status(400).json({
        error: 'Title is required'
      });
    }

    const mediaFile =
      getFile(files, 'media');

    const hasUploadedFile =
      hasFile(mediaFile);

    if (!hasUploadedFile && !youtubeUrl) {
      return res.status(400).json({
        error:
          'Provide either an image/video file or a YouTube URL'
      });
    }

    if (hasUploadedFile && youtubeUrl) {
      return res.status(400).json({
        error:
          'Provide either an image/video file or a YouTube URL, not both'
      });
    }

    await ensureSchema(owner);

    const pool =
      getPool(owner);

    let mediaType = null;
    let mediaPath = null;

    if (youtubeUrl) {
      const videoId =
        extractYouTubeId(youtubeUrl);

      if (!videoId) {
        return res.status(400).json({
          error:
            'Could not parse a YouTube video ID from that URL'
        });
      }

      mediaType = 'youtube';
      mediaPath = videoId;
    }

    if (hasUploadedFile) {
      const filename =
        mediaFile.originalFilename ||
        '';

      if (!ALLOWED_EXT.test(filename)) {
        return res.status(400).json({
          error:
            'Unsupported file type. Use JPG, PNG, GIF, WEBP, MP4, WEBM, or MOV.'
        });
      }

      const filePath =
        mediaFile.filepath ||
        mediaFile.path;

      const buffer =
        await fs.promises.readFile(
          filePath
        );

      const contentType =
        mediaFile.mimetype ||
        'application/octet-stream';

      const blob =
        await put(
          `media/${owner}/${Date.now()}-${filename}`,
          buffer,
          {
            access: 'public',
            contentType
          }
        );

      mediaPath = blob.url;

      mediaType =
        VIDEO_EXT.test(filename) ||
        contentType.startsWith('video/')
          ? 'video'
          : 'image';

      try {
        await fs.promises.unlink(
          filePath
        );
      } catch {}
    }

    const result =
      await pool.query(
        `
        INSERT INTO projects (
          owner,
          title,
          description,
          tags,
          media_type,
          media_path,
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
          $8
        )
        RETURNING *
        `,
        [
          owner,
          title,
          description,
          tags,
          mediaType,
          mediaPath,
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
};

module.exports.config = {
  api: {
    bodyParser: false
  }
};