# Shiryu — Portfolio Site (Vercel edition)

Same site as before, rewired to run on Vercel:

| Piece            | Before (local)        | Now (Vercel)                     |
|-------------------|------------------------|-----------------------------------|
| Server            | Express (`server.js`) | Serverless functions in `api/`   |
| Database          | SQLite file            | Postgres (Neon, via Vercel Storage) |
| File uploads       | Local `uploads/` folder| Vercel Blob storage              |
| Frontend           | Same                   | Same (unchanged)                 |

## 1. Push this to GitHub

```bash
git init
git add .
git commit -m "portfolio site"
git remote add origin <your-repo-url>
git push -u origin main
```

`.env` is already git-ignored — your real credentials never get committed. Only `.env.example`
(the blank template) goes into the repo.

## 2. Import into Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import your GitHub repo.
2. Before the first deploy, go to your project's **Storage** tab and create:
   - A **Postgres** database (Vercel provisions this via Neon) — this auto-adds `POSTGRES_URL`
     to your project's environment variables.
   - A **Blob** store — this auto-adds `BLOB_READ_WRITE_TOKEN`.
3. Deploy. That's it — no build step needed, Vercel detects the `api/` folder and `public/`
   folder automatically.

## 3. Local development

```bash
npm install -g vercel   # if you don't have it
npm install
```

Copy your real credentials into `.env`:
```
POSTGRES_URL=...        # from Vercel dashboard -> Storage -> Postgres -> .env.local tab
BLOB_READ_WRITE_TOKEN=... # from Vercel dashboard -> Storage -> Blob -> .env.local tab
```

Then either:
```bash
vercel dev
```
which runs everything (API + static site) locally the same way it runs in production, or:
```bash
vercel link
vercel env pull .env.local
vercel dev
```
to pull your real Vercel env vars down automatically instead of copy-pasting them.

Open **http://localhost:3000** for the site, **http://localhost:3000/admin.html** for the admin panel.

## API Reference (unchanged)

| Method | Endpoint             | Description                                  |
|--------|-----------------------|-----------------------------------------------|
| GET    | `/api/projects`       | List all pieces (`?featured=1` to filter)     |
| GET    | `/api/projects/:id`   | Get one piece                                 |
| POST   | `/api/projects`       | Create a piece (multipart form: `media` file + `title`, `description`, `tags`, `featured`, `sort_order`) |
| PUT    | `/api/projects/:id`   | Update a piece                                |
| DELETE | `/api/projects/:id`   | Delete a piece (also deletes its Blob files)  |
| POST   | `/api/messages`       | Submit a contact message (JSON: `name`, `email`, `message`) |
| GET    | `/api/messages`       | List contact messages                         |

## Project structure

```
api/
  projects/
    index.js       GET (list) / POST (create) — serverless function
    [id].js        GET / PUT / DELETE one project — serverless function
  messages.js       GET / POST contact messages — serverless function
lib/
  db.js             Postgres connection + auto schema creation
  cors.js           Shared CORS headers
public/              Static frontend — served directly by Vercel, unchanged
.env.example         Template — copy to .env and fill in real values
.env                 Your real credentials (git-ignored, never commit this)
vercel.json          Minimal Vercel config
```

## Notes

- The database schema (both tables) is created automatically on first API call — no manual
  migration step needed.
- Uploaded files go straight to Vercel Blob and get a public CDN URL back — that URL is what's
  stored in Postgres as `media_path`.
- Max upload size is 100MB per file, same as before.
- If you ever outgrow Neon's free tier or Blob's free tier, both scale with paid plans directly
  from the same Vercel dashboard — no re-architecture needed.
