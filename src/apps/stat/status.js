import { state, on } from '../../core/store.js';
import { levelInfo, PERKS } from '../../core/xp.js';
import { battery } from '../../core/sensors.js';
import { sfx } from '../../core/sfx.js';
import { mascot } from '../../ui/icons.js';
import { bar, pad } from '../../ui/ui.js';

const QUIPS = [
  'TOUT VA BIEN !', 'RESTEZ HYDRATÉ.', 'BELLE JOURNÉE, CITOYEN !', 'SYSTÈMES NOMINAUX.',
  'PENSEZ À MARCHER.', 'RADIATIONS : NÉGLIGEABLES.', 'BON TRAVAIL !',
];

let root, offs = [], clock;

function block(lbl, val, frac) {
  return `<div class="stat-block"><div class="lbl">${lbl}</div><div class="val">${val}</div>${frac == null ? '' : bar(frac, 'thin')}</div>`;
}

function render() {
  const { lvl, cur, need } = levelInfo();
  const st = state.stats;
  const qs = state.quests.filter((q) => q.type === 'daily');
  const qDone = qs.filter((q) => q.done).length;
  const perks = Object.keys(state.perks).length;
  const d = new Date();
  root.querySelector('.col.l').innerHTML =
    block('NIVEAU', lvl, cur / need) +
    `<div class="hint">XP ${cur}/${need}</div>` +
    block('PAS', st.stepsToday, st.stepsToday / 10000) +
    block('QUÊTES JOUR', `${qDone}/${qs.length}`, qs.length ? qDone / qs.length : 0);
  root.querySelector('.col.r').innerHTML =
    block('HP / BATT', battery.level == null ? '--' : battery.level + (battery.charging ? '+' : ''),
      battery.level == null ? null : battery.level / 100) +
    block('PERKS', `${perks}/${PERKS.length}`, perks / PERKS.length) +
    block('HEURE', `${pad(d.getHours())}:${pad(d.getMinutes())}`) +
    `<div class="hint">${d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase()}</div>`;
}

export default {
  id: 'status',
  label: 'STATUT',
  mount(el) {
    root = document.createElement('div');
    root.className = 'status-screen';
    root.innerHTML = `<div class="col l"></div>
      <div class="mid">${mascot('mascot bob')}<div class="hint quip center">${QUIPS[0]}</div></div>
      <div class="col r"></div>`;
    el.append(root);
    render();
    offs = ['xp', 'steps', 'battery', 'quests', 'perks'].map((e) => on(e, render));
    clock = setInterval(render, 15000);
  },
  unmount() {
    offs.forEach((f) => f());
    clearInterval(clock);
  },
  onClick() {
    const m = root.querySelector('.mascot');
    m.classList.remove('cheer');
    void m.getBoundingClientRect();
    m.classList.add('cheer');
    root.querySelector('.quip').textContent = QUIPS[Math.floor(Math.random() * QUIPS.length)];
    sfx.select();
  },
};
