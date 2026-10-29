const TOPICS = {
  kindness: { label: 'Kindness', color: '#ff7b6b' }, animals: { label: 'Animals', color: '#ffc53d' },
  planet: { label: 'Planet', color: '#3f9c6c' }, health: { label: 'Health', color: '#6fb7e0' },
  science: { label: 'Science', color: '#b7a4f2' },
};
const $ = id => document.getElementById(id);
const el = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };

/** Seven stories: the newest from each topic first, then fill with the newest remaining. Photos win ties. */
function choose(stories) {
  const week = stories.filter(s => s.url && Date.now() - new Date(s.date) < 8 * 864e5);
  const pool = (week.length >= 7 ? week : stories.filter(s => s.url)).sort((a, b) => (!!b.image - !!a.image) || b.date.localeCompare(a.date));
  const picked = [];
  for (const t of Object.keys(TOPICS)) { const s = pool.find(x => x.category === t && !picked.includes(x)); if (s) picked.push(s); }
  for (const s of pool) { if (picked.length >= 7) break; if (!picked.includes(s)) picked.push(s); }
  return picked.slice(0, 7);
}

async function init() {
  let data = { stories: [] };
  for (const path of ['/api/stories', 'data/stories.json']) {
    try { const res = await fetch(path); if (res.ok) { data = await res.json(); break; } } catch {}
  }
  const list = choose(data.stories);
  const fmt = d => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  $('dates').textContent = `Good news, ${fmt(new Date(Date.now() - 6 * 864e5))} to ${fmt(new Date())}`;
  if (!list.length) { $('rest').append(el('p', { textContent: 'No stories yet. Run node scripts/fetch-news.mjs to gather some.' })); return; }
  const open = s => window.open(s.url, '_blank', 'noopener');
  const [first, ...others] = list;
  const lead = $('lead'); lead.hidden = false;
  lead.replaceChildren(
    ...(first.image ? [Object.assign(el('img', { src: first.image, alt: '' }), { onerror() { this.remove(); } })] : []),
    el('div', { className: 'tile-body' },
      el('span', { className: 'topic', textContent: [TOPICS[first.category]?.label, first.place].filter(Boolean).join(' · ') }),
      el('h2', { textContent: first.title }), el('p', { textContent: first.summary })));
  lead.style.setProperty('--c', TOPICS[first.category]?.color);
  lead.onclick = () => open(first);
  $('rest').replaceChildren(...others.map((s, i) => {
    const t = TOPICS[s.category] || TOPICS.kindness;
    const b = el('button', { className: `tile${i % 3 === 1 ? ' solid' : ''}`, type: 'button' });
    b.style.setProperty('--c', t.color);
    b.append(el('div', { className: 'tile-body' },
      el('h3', { textContent: s.title }), el('p', { textContent: s.summary }),
      el('div', { className: 'tile-foot' }, el('span', { className: 'topic', textContent: [t.label, s.place].filter(Boolean).join(' · ') }), el('span', { textContent: s.source }))));
    b.onclick = () => open(s);
    return b;
  }));
}
init();
