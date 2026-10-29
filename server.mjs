// Zero-dependency server: serves the site, takes story submissions, and lets an admin approve them.
// Run: ADMIN_TOKEN=your-secret node server.mjs   (PORT defaults to 8080)
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { locate } from './scripts/places.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT) || 8080;
const TOKEN = process.env.ADMIN_TOKEN || randomBytes(9).toString('hex');
// DATA_DIR is where submissions and refreshed stories live. Point it at a persistent volume when hosting.
const DATA = process.env.DATA_DIR ? resolve(process.env.DATA_DIR) : join(ROOT, 'data');
const SUBMISSIONS = join(DATA, 'submissions.json');
const BUNDLED_STORIES = join(ROOT, 'data', 'stories.json');
const storiesFile = async () => {
  try { await access(join(DATA, 'stories.json')); return join(DATA, 'stories.json'); } catch { return BUNDLED_STORIES; }
};
// Behind a reverse proxy (Coolify, Traefik) every request arrives from the proxy, so read the real address from it.
const clientIp = req => (process.env.TRUST_PROXY ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '') || req.socket.remoteAddress;
const CATEGORIES = ['kindness', 'animals', 'planet', 'health', 'science', 'culture'];

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
};
// Only these paths are public. Everything else (scripts, submissions, .git) stays private.
const PUBLIC = /^\/(index\.html|digest\.html|admin\.html|styles\.css|app\.js|digest\.js|admin\.js|data\/stories\.json)?$/;

const readSubmissions = async () => {
  try { return JSON.parse(await readFile(SUBMISSIONS, 'utf8')); } catch { return []; }
};
const saveSubmissions = async list => {
  await mkdir(DATA, { recursive: true });
  await writeFile(SUBMISSIONS, JSON.stringify(list, null, 2));
};
const json = (res, code, body) => {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
};
const body = req => new Promise((resolve, reject) => {
  let size = 0; const chunks = [];
  req.on('data', c => { size += c.length; if (size > 10_000) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
  req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}')); } catch (e) { reject(e); } });
});
const isAdmin = req => {
  const given = Buffer.from((req.headers.authorization || '').replace(/^Bearer /, ''));
  const real = Buffer.from(TOKEN);
  return given.length === real.length && timingSafeEqual(given, real);
};
const clean = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

// Five submissions per hour per address.
const hits = new Map();
const limited = ip => {
  const now = Date.now(), recent = (hits.get(ip) || []).filter(t => now - t < 36e5);
  recent.push(now); hits.set(ip, recent);
  return recent.length > 5;
};

async function api(req, res, url) {
  if (url.pathname === '/api/stories' && req.method === 'GET') {
    const base = JSON.parse(await readFile(await storiesFile(), 'utf8'));
    const approved = (await readSubmissions()).filter(s => s.status === 'approved');
    return json(res, 200, { ...base, stories: [...approved.map(({ status, ...s }) => s), ...base.stories] });
  }
  if (url.pathname === '/api/submit' && req.method === 'POST') {
    if (limited(clientIp(req))) return json(res, 429, { error: 'Too many stories from this device. Try again in an hour.' });
    const d = await body(req);
    const title = clean(d.title, 120), summary = clean(d.summary, 400), placeText = clean(d.place, 60);
    if (d.website) return json(res, 200, { ok: true }); // honeypot field: bots fill it in, people never see it
    if (title.length < 5 || summary.length < 20) return json(res, 400, { error: 'Add a title and a few sentences about what happened.' });
    const { place, lat, lon } = locate(placeText);
    const story = {
      id: `c-${randomBytes(5).toString('hex')}`, title, summary, place: place || placeText || null, lat, lon,
      category: CATEGORIES.includes(d.category) ? d.category : 'kindness', source: 'Community', url: null, image: null,
      date: new Date().toISOString(), status: 'pending',
    };
    const list = await readSubmissions(); list.unshift(story); await saveSubmissions(list);
    return json(res, 201, { ok: true });
  }
  if (url.pathname.startsWith('/api/admin/')) {
    if (!isAdmin(req)) return json(res, 401, { error: 'Wrong token.' });
    const list = await readSubmissions();
    if (url.pathname === '/api/admin/submissions' && req.method === 'GET') return json(res, 200, list);
    if (url.pathname === '/api/admin/review' && req.method === 'POST') {
      const { id, action, category } = await body(req);
      const i = list.findIndex(s => s.id === id);
      if (i < 0) return json(res, 404, { error: 'No such story.' });
      if (action === 'delete') list.splice(i, 1);
      else if (action === 'approve' || action === 'reject') {
        list[i].status = action === 'approve' ? 'approved' : 'rejected';
        if (CATEGORIES.includes(category)) list[i].category = category;
      } else return json(res, 400, { error: 'Unknown action.' });
      await saveSubmissions(list);
      return json(res, 200, { ok: true });
    }
  }
  json(res, 404, { error: 'Not found.' });
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('ok'); }
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (url.pathname === '/data/stories.json') {
      res.writeHead(200, { 'content-type': TYPES['.json'], 'cache-control': 'no-cache' });
      return res.end(await readFile(await storiesFile()));
    }
    const path = normalize(decodeURIComponent(url.pathname));
    if (!PUBLIC.test(path)) { res.writeHead(404); return res.end('Not found'); }
    const file = path === '/' ? 'index.html' : path.slice(1);
    const data = await readFile(join(ROOT, file));
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff' });
    res.end(data);
  } catch (err) {
    if (err.code === 'ENOENT') { res.writeHead(404); return res.end('Not found'); }
    json(res, err.message === 'too large' ? 413 : 400, { error: 'Bad request.' });
  }
}).listen(PORT, () => {
  console.log(`Good News Everywhere on http://localhost:${PORT}`);
  console.log(process.env.ADMIN_TOKEN ? 'Admin page: /admin.html (token from ADMIN_TOKEN)' : `ADMIN_TOKEN not set. Temporary token for this run: ${TOKEN}`);
});
