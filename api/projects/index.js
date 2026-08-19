const formidable = require('formidable');
const fs = require('fs');
const { put } = require('@vercel/blob');
const { pool, ensureSchema } = require('../../lib/db');
const { setCors } = require('../../lib/cors');

const ALLOWED_EXT = /\.(jpe?g|png|gif|webp|mp4|webm|mov)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov)$/i;

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  await ensureSchema();

  if (req.method === 'GET') {
    const featured = req.query.featured;
    const { rows } = featured === '1'
      ? await pool.query('SELECT * FROM projects WHERE featured = 1 ORDER BY sort_order ASC, id DESC')
      : await pool.query('SELECT * FROM projects ORDER BY sort_order ASC, id DESC');
    return res.status(200).json(rows);
  }

  if (req.method === 'POST') {
    try {
      const form = formidable({ maxFileSize: 100 * 1024 * 1024 });
      const [fields, files] = await form.parse(req);

      const title = fields.title?.[0];
      const description = fields.description?.[0] || '';
      const tags = fields.tags?.[0] || '';
      const featured = Number(fields.featured?.[0] || 0);
      const sort_order = Number(fields.sort_order?.[0] || 0);

      if (!title) return res.status(400).json({ error: 'title is required' });

      const mediaFile = files.media?.[0];
      if (!mediaFile) return res.status(400).json({ error: 'media file is required' });
      if (!ALLOWED_EXT.test(mediaFile.originalFilename)) {
        return res.status(400).json({ error: 'Unsupported file type' });
      }

      const media_type = VIDEO_EXT.test(mediaFile.originalFilename) ? 'video' : 'image';
      const buffer = fs.readFileSync(mediaFile.filepath);
      const blob = await put(
        `media/${Date.now()}-${mediaFile.originalFilename}`,
        buffer,
        { access: 'public', contentType: mediaFile.mimetype }
      );

      let thumbnail_path = null;
      const thumbFile = files.thumbnail?.[0];
      if (thumbFile) {
        const thumbBuffer = fs.readFileSync(thumbFile.filepath);
        const thumbBlob = await put(
          `media/thumb-${Date.now()}-${thumbFile.originalFilename}`,
          thumbBuffer,
          { access: 'public', contentType: thumbFile.mimetype }
        );
        thumbnail_path = thumbBlob.url;
      }

      const { rows } = await pool.query(
        `INSERT INTO projects (title, description, tags, media_type, media_path, thumbnail_path, featured, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [title, description, tags, media_type, blob.url, thumbnail_path, featured, sort_order]
      );

      return res.status(201).json(rows[0]);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  res.setHeader('Allow', ['GET', 'POST', 'OPTIONS']);
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
};

module.exports.config = {
  api: { bodyParser: false }
};
