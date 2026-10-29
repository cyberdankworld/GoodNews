const TOPICS = {
  kindness: { label: 'Kindness', color: '#ff7b6b' },
  animals: { label: 'Animals', color: '#ffc53d' },
  planet: { label: 'Planet', color: '#3f9c6c' },
  health: { label: 'Health', color: '#6fb7e0' },
  science: { label: 'Science', color: '#b7a4f2' },
};
const PAGE = 12;

const $ = id => document.getElementById(id);
const el = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...kids);
  return n;
};
const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
};

let stories = [];
let hearts = new Set(store.get('gne-hearts', []));
let topic = 'all';
let shown = PAGE;
let query = '';
let lovedOnly = false;

const matches = s => (topic === 'all' || s.category === topic)
  && (!lovedOnly || hearts.has(s.id))
  && (!query || `${s.title} ${s.summary} ${s.place || ''}`.toLowerCase().includes(query));
const visible = () => stories.filter(matches);
const topicOf = s => TOPICS[s.category] || TOPICS.kindness;
const ago = iso => {
  const days = Math.floor((Date.now() - new Date(iso)) / 864e5);
  return days < 1 ? 'Today' : days === 1 ? 'Yesterday' : days < 30 ? `${days} days ago` : new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

async function init() {
  let data = { stories: [], updated: null };
  for (const path of ['/api/stories', 'data/stories.json']) {
    try { const res = await fetch(path); if (res.ok) { data = await res.json(); break; } } catch {}
  }
  const mine = store.get('gne-mine', []);
  stories = [...mine, ...data.stories];

  $('updated').textContent = data.updated ? `Last gathered ${new Date(data.updated).toLocaleString()}.` : '';
  const placed = stories.filter(s => s.lat != null).length;
  $('hero-sub').textContent = stories.length
    ? `${stories.length} hopeful stories from ${new Set(stories.map(s => s.place).filter(Boolean)).size} places, and counting. Tap a pin to read one.`
    : 'No stories yet. Run node scripts/fetch-news.mjs to gather some.';

  buildChips();
  buildMoods();
  render();
  renderDaily();
  syncLoved();
  drawMap();
  openFromHash();
}

/* Today's pick: the same story all day, chosen from stories that have a photo. */
function renderDaily() {
  const pool = stories.filter(s => s.image && s.source !== 'You');
  if (!pool.length) return;
  const day = Math.floor(Date.now() / 864e5);
  const s = pool[day % pool.length], t = topicOf(s);
  const img = el('img', { src: s.image, alt: '' });
  img.onerror = () => img.remove();
  const card = $('daily-card');
  card.style.setProperty('--c', t.color);
  card.replaceChildren(
    el('div', { className: 'daily-img' }, img),
    el('div', { className: 'daily-text' },
      el('span', { className: 'topic', textContent: [t.label, s.place].filter(Boolean).join(' · ') }),
      el('h3', { textContent: s.title }),
      el('p', { textContent: s.summary })));
  card.onclick = () => openStory(s);
  $('daily').hidden = false;
}

function openFromHash() {
  const id = new URLSearchParams(location.hash.slice(1)).get('story');
  const s = id && stories.find(x => x.id === id);
  if (s) openStory(s);
}

function buildChips() {
  const box = $('chips');
  box.replaceChildren(chip('all', 'Everything'), ...Object.entries(TOPICS).map(([k, t]) => chip(k, t.label, t.color)));
  function chip(key, label, color) {
    const b = el('button', { className: 'chip', type: 'button', textContent: label });
    b.setAttribute('aria-pressed', key === topic);
    if (key === 'all') b.dataset.all = '';
    if (color) b.style.setProperty('--c', color);
    b.onclick = () => {
      topic = key; shown = PAGE;
      box.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c === b));
      render(); updatePins();
    };
    return b;
  }
}

function render() {
  const list = visible();
  const feed = $('feed');
  if (!list.length) {
    feed.replaceChildren(el('p', { className: 'empty', textContent: lovedOnly && !hearts.size
      ? 'You haven’t loved a story yet. Open one and tap “Love this” to keep it here.'
      : 'No stories match. Try another topic or a different search.' }));
  } else {
    feed.replaceChildren(...list.slice(0, shown).map(tile));
  }
  $('more').parentElement.hidden = list.length <= shown;
}
$('more').onclick = () => { shown += PAGE; render(); };

function tile(s, i) {
  const t = topicOf(s);
  const hasImg = !!s.image;
  const cls = ['tile'];
  if (hasImg && i % 5 === 0) cls.push('wide');
  else if (!hasImg || i % 4 === 3) cls.push('solid');
  const b = el('button', { className: cls.join(' '), type: 'button' });
  b.style.setProperty('--c', t.color);
  if (hasImg && !cls.includes('solid')) {
    const img = el('img', { src: s.image, alt: '', loading: 'lazy' });
    img.onerror = () => img.remove();
    b.append(img);
  }
  b.append(el('div', { className: 'tile-body' },
    el('h3', { textContent: s.title }),
    el('p', { textContent: s.summary }),
    el('div', { className: 'tile-foot' },
      el('span', { className: 'topic', textContent: s.place ? `${t.label} · ${s.place}` : t.label }),
      el('span', { textContent: ago(s.date) }))));
  b.onclick = () => openStory(s);
  return b;
}

/* Reader */
const reader = $('reader');
let current = null;
function openStory(s) {
  current = s;
  const t = topicOf(s);
  $('r-img').replaceChildren(...(s.image ? [Object.assign(el('img', { src: s.image, alt: '' }), { onerror() { this.remove(); } })] : []));
  $('r-meta').textContent = [t.label, s.place, s.source, ago(s.date)].filter(Boolean).join('  ·  ');
  $('r-title').textContent = s.title;
  $('r-summary').textContent = s.summary;
  const link = $('r-link');
  s.url ? (link.href = s.url, link.hidden = false) : (link.hidden = true);
  syncHeart();
  const list = visible(), i = list.findIndex(x => x.id === s.id);
  $('r-prev').disabled = i < 1;
  $('r-next').disabled = i < 0 || i >= list.length - 1;
  $('r-share').textContent = 'Share';
  history.replaceState(null, '', `#story=${encodeURIComponent(s.id)}`);
  if (!reader.open) reader.showModal();
  reader.scrollTop = 0;
}
const step = d => {
  const list = visible(), i = list.findIndex(x => x.id === current.id);
  if (list[i + d]) openStory(list[i + d]);
};
$('r-prev').onclick = () => step(-1);
$('r-next').onclick = () => step(1);
reader.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') step(-1);
  if (e.key === 'ArrowRight') step(1);
});
reader.addEventListener('close', () => history.replaceState(null, '', location.pathname + location.search));
$('r-share').onclick = async e => {
  const url = current.url || location.href;
  try {
    if (navigator.share) await navigator.share({ title: current.title, url });
    else { await navigator.clipboard.writeText(url); e.currentTarget.textContent = 'Link copied'; }
  } catch {}
};
$('close').onclick = () => reader.close();
reader.addEventListener('click', e => { if (e.target === reader) reader.close(); });
function syncHeart() { $('r-heart').setAttribute('aria-pressed', hearts.has(current.id)); }
$('r-heart').onclick = e => {
  hearts.has(current.id) ? hearts.delete(current.id) : hearts.add(current.id);
  store.set('gne-hearts', [...hearts]);
  syncHeart(); syncLoved();
  if (lovedOnly) { render(); updatePins(); }
  e.currentTarget.classList.remove('pop'); void e.currentTarget.offsetWidth; e.currentTarget.classList.add('pop');
};
function syncLoved() { $('loved-n').textContent = stories.filter(s => hearts.has(s.id)).length; }
$('loved').onclick = e => {
  lovedOnly = !lovedOnly; shown = PAGE;
  e.currentTarget.setAttribute('aria-pressed', lovedOnly);
  render(); updatePins();
};
let timer;
$('search').addEventListener('input', e => {
  clearTimeout(timer);
  timer = setTimeout(() => { query = e.target.value.trim().toLowerCase(); shown = PAGE; render(); updatePins(); }, 150);
});
$('surprise').onclick = () => {
  const list = visible(); if (list.length) openStory(list[Math.floor(Math.random() * list.length)]);
};

/* Map */
const W = 1000, H = 500;
let pinNodes = [];

async function drawMap() {
  const svg = d3.select('#map').attr('viewBox', `0 0 ${W} ${H}`);
  const projection = d3.geoNaturalEarth1().fitExtent([[10, 10], [W - 10, H - 10]], { type: 'Sphere' });
  const path = d3.geoPath(projection);
  try {
    const world = await (await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json')).json();
    svg.append('g').selectAll('path').data(topojson.feature(world, world.objects.countries).features)
      .join('path').attr('class', 'land').attr('d', path);
  } catch {}

  // The sun, at the point on Earth where it is directly overhead right now.
  const now = new Date();
  const utcH = now.getUTCHours() + now.getUTCMinutes() / 60;
  const doy = (now - Date.UTC(now.getUTCFullYear(), 0, 0)) / 864e5;
  const sunLon = -(utcH - 12) * 15, sunLat = 23.44 * Math.sin(2 * Math.PI * (doy - 81) / 365);
  const [sx, sy] = projection([sunLon, sunLat]);
  svg.append('circle').attr('class', 'sun-glow').attr('cx', sx).attr('cy', sy).attr('r', 70);
  svg.append('circle').attr('class', 'sun-glow').attr('cx', sx).attr('cy', sy).attr('r', 42);
  svg.append('circle').attr('class', 'sun-core').attr('cx', sx).attr('cy', sy).attr('r', 18);
  $('sun-note').textContent = 'The sun is directly overhead at the yellow glow, right now.';

  // Pins. Spread stories from the same country slightly so none hide behind another.
  const tip = el('div', { className: 'tip', role: 'presentation' });
  $('map').parentElement.append(tip);
  const counts = {};
  const g = svg.append('g');
  pinNodes = stories.filter(s => s.lat != null).map((s, i) => {
    const k = s.place, n = counts[k] = (counts[k] || 0) + 1;
    const [x0, y0] = projection([s.lon, s.lat]);
    const a = n * 2.4, r = n === 1 ? 0 : 7 + n * 2.2;
    const x = x0 + Math.cos(a) * r, y = y0 + Math.sin(a) * r;
    const node = g.append('g').attr('class', 'pin').attr('tabindex', 0).attr('role', 'button')
      .attr('aria-label', `${s.title}, ${s.place}`)
      .style('--c', topicOf(s).color).style('--d', `${(i % 8) * 0.4}s`).style('--i', i);
    node.append('circle').attr('class', 'halo').attr('cx', x).attr('cy', y).attr('r', 7);
    node.append('circle').attr('class', 'dot').attr('cx', x).attr('cy', y).attr('r', 6.5);
    const show = () => {
      const box = $('map').getBoundingClientRect(), host = $('map').parentElement.getBoundingClientRect();
      tip.textContent = `${s.place}: ${s.title}`;
      tip.style.left = `${(x / W) * box.width + box.left - host.left}px`;
      tip.style.top = `${(y / H) * box.height + box.top - host.top}px`;
      tip.classList.add('on');
    };
    node.on('mouseenter focus', show).on('mouseleave blur', () => tip.classList.remove('on'))
      .on('click', () => openStory(s))
      .on('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openStory(s); } });
    return { s, node };
  });
  updatePins();
}
function updatePins() {
  pinNodes.forEach(({ s, node }) => node.classed('dim', !matches(s)));
}

/* Mood picker: three calm stories matched to how you feel. */
const MOODS = [
  { label: 'Worn out by the news', topics: ['kindness', 'health'] },
  { label: 'In need of a smile', topics: ['animals'] },
  { label: 'Worried about the planet', topics: ['planet'] },
  { label: 'Curious', topics: ['science'] },
];
function buildMoods() {
  const box = $('moods'), out = $('mood-out');
  const pick = mood => {
    const pool = stories.filter(s => mood.topics.includes(s.category));
    const three = pool.sort(() => Math.random() - 0.5).slice(0, 3);
    out.replaceChildren(...three.map((s, i) => {
      const b = el('button', { className: 'pick', type: 'button' },
        el('strong', { textContent: s.title }),
        el('span', { textContent: [topicOf(s).label, s.place].filter(Boolean).join(' · ') }));
      b.style.setProperty('--c', topicOf(s).color);
      b.style.setProperty('--d', `${i * 70}ms`);
      b.onclick = () => openStory(s);
      return b;
    }), ...(pool.length > 3 ? [el('button', { className: 'mood-more', type: 'button', textContent: 'Show me three more', onclick: () => pick(mood) })] : []));
    if (!three.length) out.replaceChildren(el('p', { textContent: 'Nothing for that mood yet. Check back after the next update.' }));
  };
  box.replaceChildren(...MOODS.map(m => {
    const b = el('button', { className: 'chip', type: 'button', textContent: m.label });
    b.onclick = () => { box.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c === b)); pick(m); };
    return b;
  }));
}

/* Share form */
$('share-form').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.currentTarget, msg = $('form-msg'), btn = form.querySelector('button');
  const f = Object.fromEntries(new FormData(form));
  btn.disabled = true; msg.textContent = '';
  try {
    const res = await fetch('/api/submit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(f) });
    const out = await res.json().catch(() => ({}));
    if (res.status === 404 || res.status === 405 || res.status === 501) throw new Error('offline');
    if (!res.ok) { msg.textContent = out.error || 'That didn’t send. Try again.'; return; }
    form.reset();
    msg.textContent = 'Thank you. We’ll read it, and if it fits it will go on the map.';
  } catch {
    // No server (for example the static preview): keep the story on this device only.
    const s = {
      id: `mine-${Date.now()}`, title: f.title.trim(), summary: f.summary.trim(), place: f.place.trim() || null,
      source: 'You', url: null, date: new Date().toISOString(), category: f.category, lat: null, lon: null, image: null,
    };
    store.set('gne-mine', [s, ...store.get('gne-mine', [])]);
    stories.unshift(s); form.reset(); topic = 'all'; shown = PAGE; buildChips(); render();
    msg.textContent = 'Saved on this device. Run the site with node server.mjs to send stories for review.';
  } finally { btn.disabled = false; }
});

init();
