const formidable = require('formidable');
const fs = require('fs');
const { put, del } = require('@vercel/blob');
const { getPool, ensureSchema } = require('../../lib/db');
const { setCors } = require('../../lib/cors');

const VIDEO_EXT = /\.(mp4|webm|mov)$/i;

function extractYouTubeId(url) {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  const owner = req.query.owner || 'shiryu';
  await ensureSchema(owner);
  const pool = getPool(owner);

  if (req.method === 'GET') {
    const { rows } = await pool.query('SELECT * FROM projects WHERE id = $1 AND owner = $2', [id, owner]);
    if (!rows[0]) return res.status(404).json({ error: 'Project not found' });
    return res.status(200).json(rows[0]);
  }

  if (req.method === 'DELETE') {
    const { rows } = await pool.query('SELECT * FROM projects WHERE id = $1 AND owner = $2', [id, owner]);
    if (!rows[0]) return res.status(404).json({ error: 'Project not found' });

    const existing = rows[0];
    try {
      if (existing.media_path) await del(existing.media_path);
      if (existing.thumbnail_path) await del(existing.thumbnail_path);
    } catch (_) { /* blob may already be gone, ignore */ }

    await pool.query('DELETE FROM projects WHERE id = $1 AND owner = $2', [id, owner]);
    return res.status(200).json({ success: true });
  }

  if (req.method === 'PUT') {
    try {
      const { rows } = await pool.query('SELECT * FROM projects WHERE id = $1 AND owner = $2', [id, owner]);
      if (!rows[0]) return res.status(404).json({ error: 'Project not found' });
      const existing = rows[0];

      const form = formidable({ maxFileSize: 100 * 1024 * 1024 });
      const [fields, files] = await form.parse(req);

      const title = fields.title?.[0] ?? existing.title;
      const description = fields.description?.[0] ?? existing.description;
      const tags = fields.tags?.[0] ?? existing.tags;
      const featured = fields.featured?.[0] !== undefined ? Number(fields.featured[0]) : existing.featured;
      const sort_order = fields.sort_order?.[0] !== undefined ? Number(fields.sort_order[0]) : existing.sort_order;

      let media_type = existing.media_type;
      let media_path = existing.media_path;
      let thumbnail_path = existing.thumbnail_path;

      const youtubeUrl = fields.youtube_url?.[0];
      const mediaFile = files.media?.[0];

      if (youtubeUrl) {
        const videoId = extractYouTubeId(youtubeUrl);
        if (!videoId) return res.status(400).json({ error: 'Could not parse a YouTube video ID from that URL' });
        media_type = 'youtube';
        media_path = videoId;
      } else if (mediaFile) {
        media_type = VIDEO_EXT.test(mediaFile.originalFilename) ? 'video' : 'image';
        const buffer = fs.readFileSync(mediaFile.filepath);
        const blob = await put(`media/${Date.now()}-${mediaFile.originalFilename}`, buffer, {
          access: 'public', contentType: mediaFile.mimetype
        });
        media_path = blob.url;
      }

      const thumbFile = files.thumbnail?.[0];
      if (thumbFile) {
        const thumbBuffer = fs.readFileSync(thumbFile.filepath);
        const thumbBlob = await put(`media/thumb-${Date.now()}-${thumbFile.originalFilename}`, thumbBuffer, {
          access: 'public', contentType: thumbFile.mimetype
        });
        thumbnail_path = thumbBlob.url;
      }

      const updated = await pool.query(
        `UPDATE projects SET title=$1, description=$2, tags=$3, media_type=$4, media_path=$5, thumbnail_path=$6, featured=$7, sort_order=$8
         WHERE id=$9 RETURNING *`,
        [title, description, tags, media_type, media_path, thumbnail_path, featured, sort_order, id]
      );

      return res.status(200).json(updated.rows[0]);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  res.setHeader('Allow', ['GET', 'PUT', 'DELETE', 'OPTIONS']);
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
};

module.exports.config = {
  api: { bodyParser: false }
};
