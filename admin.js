const $ = id => document.getElementById(id);
const TOPICS = ['kindness', 'animals', 'planet', 'health', 'science'];
let token = '';
try { token = sessionStorage.getItem('gne-admin') || ''; } catch {}

const call = async (path, body) => {
  const res = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: { authorization: `Bearer ${token}`, ...(body && { 'content-type': 'application/json' }) },
    body: body && JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
};

async function load() {
  try {
    const list = await call('/api/admin/submissions');
    try { sessionStorage.setItem('gne-admin', token); } catch {}
    $('msg').textContent = list.filter(s => s.status === 'pending').length
      ? `${list.filter(s => s.status === 'pending').length} waiting for review.`
      : 'Nothing waiting. New stories will show up here.';
    $('list').replaceChildren(...list.map(card));
  } catch (err) {
    $('msg').textContent = err.message;
    $('list').replaceChildren();
  }
}

function card(s) {
  const sel = document.createElement('select');
  sel.setAttribute('aria-label', 'Topic');
  TOPICS.forEach(t => sel.append(Object.assign(document.createElement('option'), { value: t, textContent: t[0].toUpperCase() + t.slice(1), selected: t === s.category })));
  const act = (action, label, cls = '') => {
    const b = Object.assign(document.createElement('button'), { className: `btn ${cls}`, type: 'button', textContent: label });
    b.onclick = async () => { b.disabled = true; try { await call('/api/admin/review', { id: s.id, action, category: sel.value }); await load(); } catch (e) { $('msg').textContent = e.message; b.disabled = false; } };
    return b;
  };
  const row = document.createElement('div'); row.className = 'row';
  row.append(sel, act('approve', 'Approve'), act('reject', 'Reject', 'quiet'), act('delete', 'Delete', 'quiet'));
  const state = Object.assign(document.createElement('span'), { className: `state ${s.status}`, textContent: s.status });
  const art = document.createElement('article'); art.className = 'sub';
  const h = document.createElement('h2'); h.textContent = s.title;
  const p = document.createElement('p'); p.textContent = s.summary;
  const meta = document.createElement('p'); meta.className = 'meta';
  meta.textContent = `${s.place || 'No place given'}${s.lat == null ? ' (not on the map)' : ''} · ${new Date(s.date).toLocaleString()} `;
  meta.append(state);
  art.append(h, p, meta, row);
  return art;
}

$('login').onsubmit = e => { e.preventDefault(); token = $('token').value.trim(); load(); };
if (token) load();
