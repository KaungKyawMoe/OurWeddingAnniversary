const express = require('express'), multer = require('multer'), bcrypt = require('bcryptjs');
const crypto = require('crypto'), fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 3000, PROD = process.env.NODE_ENV === 'production';
const DATA = process.env.DATA_DIR || path.join(__dirname, 'data'), UP = path.join(DATA, 'uploads');
const SECRET = process.env.SESSION_SECRET, HASH = process.env.ADMIN_PASSWORD_HASH, PLAIN = process.env.ADMIN_PASSWORD;
if (!SECRET || SECRET.length < 32 || !(HASH || PLAIN)) {
  console.error('Set SESSION_SECRET (32+ chars) and ADMIN_PASSWORD_HASH (see README).'); process.exit(1);
}
fs.mkdirSync(UP, { recursive: true });

// ---- storage: two JSON files (draft = what you edit, published = what visitors see)
const read = (n, d) => { try { return JSON.parse(fs.readFileSync(path.join(DATA, n), 'utf8')); } catch { return d; } };
const write = (n, o) => { const f = path.join(DATA, n); fs.writeFileSync(f + '.tmp', JSON.stringify(o)); fs.renameSync(f + '.tmp', f); };
const EMPTY = { text: {}, theme: {}, images: {} };
const FONTS = ['Brush Script MT', 'Great Vibes', 'Dancing Script', 'Allura', 'Parisienne', 'Georgia', 'Playfair Display', 'Cormorant Garamond', 'Lora', 'Libre Baskerville'];
const COLORS = ['rose', 'deepRose', 'ivory', 'blush', 'ink', 'gold'];
function clean(b) {
  const o = { text: {}, theme: {}, images: {} }; b = b || {};
  for (const [k, v] of Object.entries(b.text || {})) if (/^[a-z0-9_]{1,40}$/.test(k) && typeof v === 'string') o.text[k] = v.slice(0, 6000);
  const t = b.theme || {};
  for (const c of COLORS) if (/^#[0-9a-f]{6}$/i.test(t[c])) o.theme[c] = t[c];
  for (const f of ['scriptFont', 'bodyFont']) if (FONTS.includes(t[f])) o.theme[f] = t[f];
  if (typeof t.scale === 'number' && t.scale >= .85 && t.scale <= 1.25) o.theme.scale = t.scale;
  if (typeof t.hearts === 'boolean') o.theme.hearts = t.hearts;
  for (const [k, v] of Object.entries(b.images || {}))
    if (/^[a-z0-9]{1,20}$/.test(k) && (v === null || /^[a-f0-9]{24}\.(jpg|png|gif|webp)$/.test(v))) o.images[k] = v;
  return o;
}

// ---- auth: stateless signed cookie, bcrypt password, login rate-limit
const sign = e => crypto.createHmac('sha256', SECRET).update(String(e)).digest('hex');
const authed = req => {
  const m = /(?:^|; )sid=(\d+)\.([a-f0-9]{64})/.exec(req.headers.cookie || '');
  return !!m && +m[1] > Date.now() && crypto.timingSafeEqual(Buffer.from(m[2]), Buffer.from(sign(m[1])));
};
const fails = new Map();
const app = express();
app.disable('x-powered-by'); app.set('trust proxy', 1);
app.use((req, res, next) => {
  if (PROD && req.headers['x-forwarded-proto'] === 'http') return res.redirect(301, 'https://' + req.headers.host + req.url);
  res.set({
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'SAMEORIGIN',
    'Strict-Transport-Security': 'max-age=31536000',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; frame-ancestors 'self'; form-action 'self'"
  });
  next();
});
app.use(express.json({ limit: '300kb' }));
const guard = (req, res, next) => {
  if (!authed(req)) return res.status(401).json({ error: 'Not signed in' });
  if (req.method !== 'GET' && req.get('X-Requested-With') !== 'admin') return res.status(403).json({ error: 'Bad request' });
  next();
};

app.post('/api/login', async (req, res) => {
  const ip = req.ip, f = fails.get(ip) || { n: 0, t: Date.now() };
  if (Date.now() - f.t > 9e5) { f.n = 0; f.t = Date.now(); }
  if (f.n >= 5) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  const pw = String((req.body || {}).password || '');
  const ok = HASH ? await bcrypt.compare(pw, HASH) : (pw.length === PLAIN.length && crypto.timingSafeEqual(Buffer.from(pw), Buffer.from(PLAIN)));
  if (!ok) { fails.set(ip, { n: f.n + 1, t: f.t }); await new Promise(r => setTimeout(r, 600)); return res.status(401).json({ error: 'Wrong password' }); }
  fails.delete(ip);
  const exp = Date.now() + 8 * 36e5;
  res.set('Set-Cookie', `sid=${exp}.${sign(exp)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${PROD ? '; Secure' : ''}`);
  res.json({ ok: true });
});
app.post('/api/logout', (req, res) => { res.set('Set-Cookie', 'sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'); res.json({ ok: true }); });
app.get('/api/me', guard, (req, res) => res.json({ ok: true }));

// ---- public content
app.get('/api/content', (req, res) => { res.set('Cache-Control', 'no-cache'); res.json(read('published.json', EMPTY)); });

// ---- admin API
app.get('/api/draft', guard, (req, res) => { const p = read('published.json', EMPTY); res.json({ draft: read('draft.json', p), published: p }); });
app.put('/api/draft', guard, (req, res) => { write('draft.json', clean(req.body)); res.json({ ok: true }); });
app.post('/api/discard', guard, (req, res) => { const p = read('published.json', EMPTY); write('draft.json', p); res.json({ draft: p }); });
app.post('/api/publish', guard, (req, res) => {
  const d = clean(req.body); write('draft.json', d); write('published.json', d);
  const used = new Set(Object.values(d.images).filter(Boolean));          // remove orphaned uploads
  for (const f of fs.readdirSync(UP)) if (!used.has(f) && Date.now() - fs.statSync(path.join(UP, f)).mtimeMs > 36e5) fs.unlinkSync(path.join(UP, f));
  res.json({ ok: true });
});
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8e6, files: 1 } }).single('file');
const kind = b => b.slice(0, 3).equals(Buffer.from([255, 216, 255])) ? 'jpg' : b.slice(1, 4).toString() === 'PNG' ? 'png' : b.slice(0, 4).toString() === 'GIF8' ? 'gif'
  : (b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP') ? 'webp' : null;
app.post('/api/upload', guard, (req, res) => upload(req, res, err => {
  if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Image is over 8 MB' : 'Upload failed' });
  const ext = req.file && kind(req.file.buffer);
  if (!ext) return res.status(400).json({ error: 'Use a JPG, PNG, GIF or WebP image' });
  const name = crypto.randomBytes(12).toString('hex') + '.' + ext;
  fs.writeFileSync(path.join(UP, name), req.file.buffer); res.json({ file: name });
}));

// ---- static
app.get('/robots.txt', (req, res) => res.type('text').send('User-agent: *\nDisallow: /admin\n'));
app.get('/admin', (req, res) => { res.set({ 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store' }); res.sendFile(path.join(__dirname, 'admin/admin.html')); });
app.use('/uploads', express.static(UP, { maxAge: '30d', immutable: true }));
app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html' }));
app.use((err, req, res, next) => res.status(400).json({ error: 'Bad request' }));
app.listen(PORT, () => console.log('Running on port ' + PORT));
