// MAP > PROCHE: places around the user, sorted by distance, filterable by category, with guidance.
import { on } from '../../core/store.js';
import { fmtDist } from '../../core/geo.js';
import { sfx } from '../../core/sfx.js';
import { List } from '../../ui/list.js';
import { esc, toast } from '../../ui/ui.js';
import { dirName } from '../inv/views.js';
import { nav, navStart, navStop, loadPois, navInfo, setTarget, isTarget, arrowSvg, CATS } from './nav.js';

const FILTER = { filter: true };
let list, offs = [], catIdx = -1; // -1 = all categories

function items() {
  const pois = (nav.pois || [])
    .filter((p) => catIdx < 0 || p.cat === CATS[catIdx])
    .map((p) => ({ p, d: navInfo(p)?.d ?? 0 }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 80)
    .map((x) => x.p);
  return [FILTER, ...pois];
}

function status() {
  if (!nav.pos) return 'LOCALISATION EN COURS...';
  if (nav.loadingPois) return 'SCAN DES ENVIRONS (1 KM)...';
  if (nav.poisErr) return 'SCAN IMPOSSIBLE · CLIC SUR UN LIEU OU RÉESSAYEZ PLUS TARD';
  return `${(nav.pois || []).length} LIEUX DANS UN RAYON DE 1 KM · POSITION : ${nav.pos.src}`;
}

export function navBlock(p) {
  const info = navInfo(p);
  if (!info) return '';
  const deg = info.rel ?? info.b;
  return `<div style="display:flex;align-items:center;gap:6px;margin:3px 0">${arrowSvg(deg)}
    <div><div class="big" style="font-size:22px">${fmtDist(info.d)}</div>
    <div class="hint">${info.rel == null ? `VERS LE ${dirName(info.b)} (NORD EN HAUT)` : 'LA FLÈCHE POINTE LE LIEU'}</div></div></div>`;
}

function detail(it) {
  if (it === FILTER) {
    return `<div class="h">CATÉGORIE</div>
      <div class="row hl"><span>FILTRE</span><b>${catIdx < 0 ? 'TOUT' : CATS[catIdx].name}</b></div>
      ${CATS.map((c) => `<div class="row"><span>${c.g} ${c.name}</span><b>${(nav.pois || []).filter((p) => p.cat === c).length}</b></div>`).join('')}
      <p class="hint wrap">${status()}</p><div class="hint">CLIC : CHANGER DE CATÉGORIE</div>`;
  }
  const guided = isTarget(it);
  return `<div class="h wrap" style="max-height:30px;overflow:hidden">${esc(it.name)}</div>
    <div class="row"><span>${it.cat.g}</span><b>${esc(it.type)}</b></div>
    ${navBlock(it)}
    ${it.addr ? `<div class="hint wrap">${esc(it.addr.toUpperCase())}</div>` : ''}
    ${it.hours ? `<div class="hint wrap" style="max-height:24px;overflow:hidden">⌚ ${esc(it.hours)}</div>` : ''}
    ${it.phone ? `<div class="hint">☎ ${esc(it.phone)}</div>` : ''}
    <div class="hint" style="margin-top:2px">${guided ? 'GUIDAGE EN COURS · CLIC : ARRÊTER' : 'CLIC : GUIDER'}</div>`;
}

function select(it) {
  if (it === FILTER) {
    catIdx = catIdx + 1 >= CATS.length ? -1 : catIdx + 1;
    sfx.select();
    list.setItems(items());
    if (!nav.pois && !nav.loadingPois) loadPois(true);
    return;
  }
  if (isTarget(it)) {
    setTarget(null);
    sfx.back();
    toast('GUIDAGE', 'ARRÊTÉ');
  } else {
    setTarget(it);
    sfx.select();
    toast('GUIDAGE', it.name);
  }
  list.renderDetail();
}

export default {
  id: 'nearby',
  label: 'PROCHE',
  mount(el) {
    list = new List(el, {
      width: 112,
      label: (it) => (it === FILTER ? `◐ ${catIdx < 0 ? 'TOUT' : CATS[catIdx].name}` : `${isTarget(it) ? '▶' : it.cat.g} ${esc(it.name)}`),
      detail,
      onSelect: select,
    });
    list.setItems(items());
    offs = [
      on('pois', () => list.setItems(items())),
      on('nav', () => list.setItems(items())),
      on('heading', () => list.renderDetail()),
    ];
    navStart();
  },
  unmount() {
    offs.forEach((f) => f());
    navStop();
  },
  onScroll: (d) => list.move(d),
  onClick: () => list.select(),
};
