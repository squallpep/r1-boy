// R1-BOY 3000: shell (tabs, sub-tabs, status bar, input routing) for the Rabbit R1.
import './ui/crt.css';
import { load, state, save, on, flush } from './core/store.js';
import { initInput } from './core/input.js';
import { sfx } from './core/sfx.js';
import { boot } from './core/boot.js';
import { checkUpdate } from './core/update.js';
import { levelInfo, checkPerks } from './core/xp.js';
import { battery, initBattery, rollDay, setPedometer } from './core/sensors.js';
import { setRoot, getModal, pad } from './ui/ui.js';
import status from './apps/stat/status.js';
import quests from './apps/stat/quests.js';
import perks from './apps/stat/perks.js';
import { toolsScreen, sensorsScreen } from './apps/inv/tools.js';
import weather from './apps/data/weather.js';
import ai from './apps/data/ai.js';
import config, { applyTheme } from './apps/data/config.js';
import map from './apps/map/map.js';
import radio from './apps/radio/radio.js';
import tv from './apps/radio/tv.js';
import { player } from './apps/radio/player.js';

const TABS = [
  { label: 'STAT', subs: [status, quests, perks] },
  { label: 'INV', subs: [toolsScreen, sensorsScreen] },
  { label: 'DATA', subs: [weather, ai, config] },
  { label: 'MAP', subs: [map] },
  { label: 'RADIO', subs: [radio, tv] },
];
const FLAT = TABS.flatMap((t, ti) => t.subs.map((_, si) => [ti, si]));

const app = document.getElementById('app');
let tabsEl, subsEl, contentEl, statusEl;
let ti = 0, si = 0, current = null, mode = 'content', pendingMount = null;

function noiseTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const img = g.createImageData(64, 64);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return `url(${c.toDataURL()})`;
}

function buildShell() {
  app.innerHTML = `<div class="tabs"></div><div class="subtabs"></div><div class="content"></div><div class="statusbar"></div><div id="crt"></div>`;
  [tabsEl, subsEl, contentEl, statusEl] = ['.tabs', '.subtabs', '.content', '.statusbar'].map((s) => app.querySelector(s));
  app.querySelector('#crt').style.setProperty('--noise', noiseTexture());
  tabsEl.addEventListener('click', (e) => {
    const t = e.target.closest('.tab');
    if (!t) return;
    mode = 'content';
    go(+t.dataset.i, 0);
  });
  subsEl.addEventListener('click', (e) => {
    const s = e.target.closest('.sub');
    if (!s) return;
    mode = 'content';
    go(ti, +s.dataset.i);
  });
}

function renderHeader() {
  tabsEl.classList.toggle('nav', mode === 'tabs');
  tabsEl.innerHTML = TABS.map((t, i) => `<div class="tab ${i === ti ? 'on' : ''}" data-i="${i}"><span>${t.label}</span></div>`).join('');
  subsEl.innerHTML = TABS[ti].subs.map((s, i) => `<span class="sub ${i === si ? 'on' : ''}" data-i="${i}">${s.label}</span>`).join('');
}

function renderStatus() {
  const { lvl, cur, need } = levelInfo();
  const d = new Date();
  const hp = battery.level == null ? '--' : battery.level;
  const note = player.status === 'play' ? '<span class="note">♪</span>' : '';
  statusEl.innerHTML = `<div class="sb">HP ${hp}</div>
    <div class="sb grow">NIV ${lvl}<div class="bar"><i style="width:${(cur / need) * 100}%"></i></div>${note}</div>
    <div class="sb">${pad(d.getHours())}:${pad(d.getMinutes())}</div>`;
}

function mountCurrent() {
  pendingMount = null;
  current?.unmount?.();
  contentEl.innerHTML = '';
  contentEl.classList.remove('glitch');
  void contentEl.offsetWidth;
  contentEl.classList.add('glitch');
  current = TABS[ti].subs[si];
  current.mount(contentEl);
}

function go(t, s, { deferMount = false } = {}) {
  ti = t;
  si = s;
  state.ui = { tab: ti, sub: si };
  save();
  sfx.tab();
  renderHeader();
  clearTimeout(pendingMount);
  // While spinning through tabs, wait until the wheel settles before mounting heavy screens.
  if (deferMount) pendingMount = setTimeout(mountCurrent, 260);
  else mountCurrent();
}

function cycle(dir) {
  const k = FLAT.findIndex(([a, b]) => a === ti && b === si);
  const [t, s] = FLAT[(k + dir + FLAT.length) % FLAT.length];
  go(t, s, { deferMount: true });
}

const input = {
  scroll(dir) {
    const m = getModal();
    if (m) return m.scroll(dir);
    if (mode === 'tabs') return cycle(dir);
    current?.onScroll?.(dir);
  },
  click() {
    sfx.unlock();
    const m = getModal();
    if (m) return m.click();
    if (mode === 'tabs') {
      mode = 'content';
      if (pendingMount) { clearTimeout(pendingMount); mountCurrent(); }
      renderHeader();
      sfx.select();
      return;
    }
    current?.onClick?.();
  },
  back() {
    const m = getModal();
    if (m) return m.back();
    if (mode === 'content' && current?.onBack?.()) return;
    mode = mode === 'tabs' ? 'content' : 'tabs';
    if (mode === 'content' && pendingMount) { clearTimeout(pendingMount); mountCurrent(); }
    sfx.back();
    renderHeader();
  },
};

async function start() {
  checkUpdate();
  await load();
  applyTheme();
  setRoot(app);
  buildShell();
  await boot(app);

  state.stats.boots++;
  if (new Date().getHours() < 5) state.stats.nightOwl = true;
  rollDay();
  save();

  initBattery();
  setPedometer(state.settings.pedometer);
  initInput(input);
  ['xp', 'battery', 'radio'].forEach((e) => on(e, renderStatus));
  setInterval(() => { rollDay(); renderStatus(); }, 20000);

  const t = Math.min(state.ui?.tab ?? 0, TABS.length - 1);
  const s = Math.min(state.ui?.sub ?? 0, TABS[t].subs.length - 1);
  go(t, s);
  renderStatus();
  checkPerks();
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) flush();
  else checkUpdate();
});
start();
