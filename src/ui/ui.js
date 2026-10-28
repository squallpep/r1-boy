// Shared UI helpers: popups, text prompt, confirmation modal, HTML escaping.
let app = null;
export function setRoot(el) { app = el; }

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---- Popups (queued, Pip-Boy style) ----
const queue = [];
let showing = false;

export function toast(title, sub = '', { big = false, ms = 1900 } = {}) {
  queue.push({ title, sub, big, ms });
  if (!showing) next();
}

function next() {
  const t = queue.shift();
  if (!t || !app) { showing = false; return; }
  showing = true;
  const el = document.createElement('div');
  el.className = 'toast' + (t.big ? ' big' : '');
  el.innerHTML = `<div class="t-title">${esc(t.title)}</div>` +
    (t.sub ? `<div class="t-sub">${esc(t.sub).replace(/\n/g, '<br>')}</div>` : '');
  app.append(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => { el.remove(); next(); }, 180);
  }, t.ms);
}

// ---- Modal (input routing goes to the modal while open) ----
let modal = null;
export const getModal = () => modal;

export function promptText(title, initial = '', placeholder = '') {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'modal';
    el.innerHTML = `<div class="m-box">
      <div class="m-title">${esc(title)}</div>
      <input class="m-input" spellcheck="false" autocomplete="off" placeholder="${esc(placeholder)}">
      <div class="m-btns"><span class="btn" data-a="ok">[ VALIDER ]</span><span class="btn" data-a="no">[ ANNULER ]</span></div>
    </div>`;
    const input = el.querySelector('input');
    input.value = initial;
    const done = (v) => { el.remove(); modal = null; resolve(v); };
    const ok = () => done(input.value.trim() || null);
    el.addEventListener('click', (e) => {
      const a = e.target.dataset.a;
      if (a === 'ok') ok();
      if (a === 'no') done(null);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); ok(); }
      if (e.key === 'Escape') { e.preventDefault(); done(null); }
    });
    modal = { click: ok, back: () => done(null), scroll() {} };
    app.append(el);
    setTimeout(() => input.focus(), 50);
  });
}

export function confirmBox(title, text) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'modal';
    el.innerHTML = `<div class="m-box">
      <div class="m-title">${esc(title)}</div>
      <div class="m-text">${esc(text)}</div>
      <div class="m-btns"><span class="btn" data-a="ok">[ OUI ]</span><span class="btn sel" data-a="no">[ NON ]</span></div>
    </div>`;
    let yes = false;
    const btns = el.querySelectorAll('.btn');
    const paint = () => { btns[0].classList.toggle('sel', yes); btns[1].classList.toggle('sel', !yes); };
    const done = (v) => { el.remove(); modal = null; resolve(v); };
    el.addEventListener('click', (e) => {
      if (e.target.dataset.a) done(e.target.dataset.a === 'ok');
    });
    modal = { click: () => done(yes), back: () => done(false), scroll: () => { yes = !yes; paint(); } };
    app.append(el);
  });
}

// Action menu: items [{ label, value }] -> Promise<value | null>.
export function menuBox(title, items) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'modal';
    el.innerHTML = `<div class="m-box"><div class="m-title">${esc(title)}</div>
      <div class="m-menu">${items.map((it, i) => `<div class="it ${i ? '' : 'sel'}" data-i="${i}">${esc(it.label)}</div>`).join('')}</div></div>`;
    let idx = 0;
    const rows = el.querySelectorAll('.it');
    const done = (v) => { el.remove(); modal = null; resolve(v); };
    const paint = () => rows.forEach((r, i) => r.classList.toggle('sel', i === idx));
    el.addEventListener('click', (e) => {
      const r = e.target.closest('.it');
      if (r) done(items[+r.dataset.i].value);
      else if (e.target === el) done(null);
    });
    modal = {
      click: () => done(items[idx].value),
      back: () => done(null),
      scroll: (d) => { idx = Math.max(0, Math.min(items.length - 1, idx + d)); paint(); },
    };
    app.append(el);
  });
}

// ---- Small formatting helpers ----
export const pad = (n, l = 2) => String(n).padStart(l, '0');

export function bar(frac, cls = '') {
  const p = Math.max(0, Math.min(1, frac)) * 100;
  return `<div class="bar ${cls}"><i style="width:${p.toFixed(1)}%"></i></div>`;
}
