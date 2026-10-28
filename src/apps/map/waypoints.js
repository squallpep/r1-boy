// MAP > REPÈRES: saved places (car, home...), address search, manual position reset, guidance.
import { state, save, on } from '../../core/store.js';
import { setManualPos } from '../../core/geo.js';
import { sfx } from '../../core/sfx.js';
import { List } from '../../ui/list.js';
import { esc, toast, promptText, menuBox } from '../../ui/ui.js';
import { nav, navStart, navStop, setTarget, isTarget, relocate } from './nav.js';
import { navBlock } from './nearby.js';

const ADD = { id: 'add', label: '+ REPÈRE ICI', desc: 'Enregistre votre position actuelle (voiture garée, point de rendez-vous...).' };
const SEARCH = { id: 'search', label: '⌕ CHERCHER ADRESSE', desc: 'Trouve une adresse ou un lieu, l\'enregistre et lance le guidage.' };
const MANUAL = { id: 'manual', label: '× POSITION MANUELLE', desc: 'Efface la position définie à la main sur la carte et revient au GPS / R1 / IP.' };

let list, offs = [];

function items() {
  return [ADD, SEARCH, ...(state.manualPos ? [MANUAL] : []), ...state.waypoints];
}

function detail(it) {
  if (it.label) {
    return `<div class="h">${it.label}</div><p class="wrap">${it.desc}</p>
      <div class="row"><span>POSITION</span><b>${nav.pos ? nav.pos.src : '...'}</b></div>
      <div class="hint">CLIC : VALIDER</div>`;
  }
  return `<div class="h wrap">${esc(it.name)}</div>${navBlock(it)}
    <div class="hint">${it.lat.toFixed(5)}, ${it.lon.toFixed(5)}</div>
    <div class="hint" style="margin-top:3px">${isTarget(it) ? 'GUIDAGE EN COURS · ' : ''}CLIC : OPTIONS</div>`;
}

async function search() {
  const q = await promptText('ADRESSE OU LIEU', '', 'ex. 10 rue de la Paix, Paris');
  if (!q) return;
  toast('RECHERCHE', q.toUpperCase());
  let res = [];
  try {
    const near = nav.pos ? `&viewbox=${nav.pos.lon - 0.5},${nav.pos.lat + 0.5},${nav.pos.lon + 0.5},${nav.pos.lat - 0.5}` : '';
    res = await (await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=6&accept-language=fr${near}&q=${encodeURIComponent(q)}`)).json();
  } catch {}
  if (!res.length) { sfx.error(); return toast('RECHERCHE', 'AUCUN RÉSULTAT'); }
  const pick = await menuBox('RÉSULTATS', res.map((r, i) => ({ label: r.display_name.toUpperCase().slice(0, 60), value: i + 1 })));
  if (!pick) return;
  const r = res[pick - 1];
  const w = { id: 'w' + Date.now(), name: r.display_name.split(',')[0].toUpperCase().slice(0, 30), lat: +r.lat, lon: +r.lon };
  state.waypoints.push(w);
  save();
  setTarget(w);
  toast('GUIDAGE', w.name);
}

async function select(it) {
  sfx.select();
  if (it === ADD) {
    if (!nav.pos) return toast('REPÈRE', 'POSITION INCONNUE');
    const name = await promptText('NOM DU REPÈRE', `REPÈRE ${state.waypoints.length + 1}`);
    if (!name) return;
    state.waypoints.push({ id: 'w' + Date.now(), name: name.toUpperCase().slice(0, 30), lat: nav.pos.lat, lon: nav.pos.lon });
    save();
    toast('REPÈRE AJOUTÉ', `${name.toUpperCase()} (${nav.pos.src})`);
  } else if (it === SEARCH) {
    await search();
  } else if (it === MANUAL) {
    setManualPos(null);
    toast('POSITION', 'MANUELLE EFFACÉE');
    relocate();
  } else {
    const a = await menuBox(it.name, [
      { label: isTarget(it) ? 'ARRÊTER LE GUIDAGE' : 'GUIDER', value: 'guide' },
      { label: 'RENOMMER', value: 'rename' },
      { label: 'SUPPRIMER', value: 'del' },
    ]);
    if (a === 'guide') setTarget(isTarget(it) ? null : it);
    if (a === 'rename') {
      const n = await promptText('NOUVEAU NOM', it.name);
      if (n) it.name = n.toUpperCase().slice(0, 30);
    }
    if (a === 'del') {
      if (isTarget(it)) setTarget(null);
      state.waypoints.splice(state.waypoints.indexOf(it), 1);
    }
    save();
  }
  list.setItems(items());
}

export default {
  id: 'waypoints',
  label: 'REPÈRES',
  mount(el) {
    list = new List(el, {
      width: 116,
      label: (it) => (it.label ? it.label : `${isTarget(it) ? '▶' : '◆'} ${esc(it.name)}`),
      detail,
      onSelect: select,
    });
    list.setItems(items());
    offs = [on('nav', () => list.setItems(items())), on('heading', () => list.renderDetail())];
    navStart();
  },
  unmount() {
    offs.forEach((f) => f());
    navStop();
  },
  onScroll: (d) => list.move(d),
  onClick: () => list.select(),
};
