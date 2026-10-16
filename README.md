# Tone Tone & Papa — Anniversary site v2 (with admin dashboard)

Your original romantic site (blush/ivory, October 12, 2026, apology + love letter) now has a private dashboard at **/admin**.

## What you can do in /admin
- **Content**: edit every piece of text (apology, love letter, reasons, captions, date…). The anniversary date is one field and updates everywhere.
- **Images**: upload, replace or delete the 6 photo slots (hero, 3 memories, letter portrait, future photo).
- **Theme & fonts**: 6 colours, script/body fonts, paragraph size, floating hearts on/off.
- **Live preview**: Desktop / Tablet / Phone views update as you type.
- **Save draft** (private) vs **Publish** (public). *Discard changes* reverts to what's live.

## Security
bcrypt-hashed password, signed HttpOnly + SameSite=Strict + Secure cookie (8 h), login rate limit (5 tries / 15 min), CSRF header check, upload type verified by file signature + 8 MB cap + random filenames, all text rendered as plain text (no HTML injection), strict CSP, HTTPS redirect, `/admin` not indexed.
Use a long password (a 4-word phrase is great).

## Run it locally
```bash
npm install
npm run hash -- "your long password here"     # copy the output
export SESSION_SECRET="$(openssl rand -hex 32)"
export ADMIN_PASSWORD_HASH='<paste hash>'
npm start        # http://localhost:3000   admin: http://localhost:3000/admin
```
(Windows PowerShell: `$env:SESSION_SECRET="..."` etc.)

## Deploy online (Render — easiest)
1. Put this folder in a **private GitHub repo** (`.gitignore` already excludes `data` and `.env`).
2. Render → New → **Web Service** → pick the repo. Build: `npm install`, Start: `npm start`.
3. Environment variables: `NODE_ENV=production`, `SESSION_SECRET` (64 random chars), `ADMIN_PASSWORD_HASH` (from `npm run hash`), `DATA_DIR=/var/data`.
4. **Add a Disk** (Advanced → Disks), mount path `/var/data`. Without a persistent disk, uploads and edits vanish on every redeploy. (Free instances have no disk; the cheapest paid plan does. Fly.io or Railway volumes work the same way.)
5. Open `https://<your-app>.onrender.com/` and `/admin`. Add a custom domain in Render if you like — HTTPS is automatic.

## Notes
- Only one admin (you). Change the password by generating a new hash and updating the env var.
- Back up the `DATA_DIR` folder (`published.json`, `draft.json`, `uploads/`) now and then.
- Photo slots start with your original `photos/*.jpg` paths; just upload through the dashboard instead.
- Files: `server.js` (API + auth), `public/index.html` (your site, editable fields tagged `data-k`), `public/site.js` (applies saved content), `admin/admin.html` (dashboard).
