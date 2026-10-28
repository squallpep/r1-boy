// MAP > LOCALE: phosphor-tinted OSM, position + source, nearby places, guidance line, compass strip.
// Click opens an action menu (recenter, set my position here, drop a marker, stop guidance...).
import { state, save, on } from '../../core/store.js';
import { addXp } from '../../core/xp.js';
import { distance, setManualPos, fmtDist } from '../../core/geo.js';
import { sfx } from '../../core/sfx.js';
import { pad, toast, menuBox, promptText, esc } from '../../ui/ui.js';
import { dirName } from '../inv/views.js';
import { nav, navStart, navStop, setPos, loadPois, navInfo, getTarget, setTarget, relocate } from './nav.js';

const DISCOVER_RADIUS = 300; // meters between two discovered places
const STRIP = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
const PX_PER_DEG = 22 / 45;

let L, map, el, me, poiLayer, placeLayer, tgtMarker, tgtLine, follow = true, offs = [];

const icon = (html, size) => L.divIcon({ className: '', html, iconSize: [size, size] });

function discover(p) {
  if (state.places.some((q) => distance(q, p) < DISCOVER_RADIUS)) return;
  state.places.push({ lat: p.lat, lon: p.lon, t: Date.now() });
  save();
  L.marker([p.lat, p.lon], { icon: icon('<div class="pin-place"></div>', 6), interactive: false }).addTo(placeLayer);
  addXp(10, 'LIEU DÉCOUVERT', `LIEU N°${state.places.length} · +10 XP`);
}

function hud() {
  if (!el || !map) return;
  const p = nav.pos;
  el.querySelector('.z').textContent = `ZOOM ${map.getZoom()}`;
  el.querySelector('.f').textContent = follow ? 'SUIVI ●' : 'LIBRE ○';
  el.querySelector('.s').textContent = p ? `POS : ${p.src}` : 'POS : ...';
  el.querySelector('.c').textContent = p ? `${p.lat.toFixed(4)} ${p.lon.toFixed(4)}` : 'LOCALISATION...';
  el.querySelector('.cross').style.display = follow ? 'none' : 'block';
  const t = getTarget();
  const bar = el.querySelector('.tgt-bar');
  const info = t && navInfo(t);
  bar.style.display = info ? 'flex' : 'none';
  if (info) bar.innerHTML = `<span>▶ ${esc(t.name)}</span><b>${fmtDist(info.d)} ${dirName(info.b)}</b>`;
}

function drawHeading() {
  if (!el) return;
  const h = nav.heading ?? 0;
  const x = (h / 45) * 22 + 8 * 22 + 11;
  el.querySelector('.ticks').style.left = `calc(50% - ${x}px)`;
  el.querySelector('.hd').textContent = nav.heading == null ? 'CAP ---' : `${dirName(h)} ${pad(Math.round(h), 3)}°`;
  // Target marker on the strip, at its bearing relative to the current heading.
  const mk = el.querySelector('.strip-tgt');
  const info = getTarget() && navInfo(getTarget());
  if (!info) { mk.style.display = 'none'; return; }
  const rel = ((info.b - h + 540) % 360) - 180;
  mk.style.display = Math.abs(rel) * PX_PER_DEG < 110 ? 'block' : 'none';
  mk.style.left = `calc(50% + ${rel * PX_PER_DEG}px)`;
}

function drawTarget() {
  if (!map) return;
  const t = getTarget();
  tgtMarker?.remove();
  tgtLine?.remove();
  tgtMarker = tgtLine = null;
  if (!t) return;
  tgtMarker = L.marker([t.lat, t.lon], { icon: icon('<div class="pin-tgt">◆</div>', 14), interactive: false }).addTo(map);
  if (nav.pos) tgtLine = L.polyline([[nav.pos.lat, nav.pos.lon], [t.lat, t.lon]], { className: 'tgt-line', weight: 2, dashArray: '4 4' }).addTo(map);
}

function drawPois() {
  if (!poiLayer) return;
  poiLayer.clearLayers();
  if (!state.settings.mapPois || !nav.pois) return;
  for (const p of nav.pois) {
    L.marker([p.lat, p.lon], { icon: icon(`<div class="pin-poi">${p.cat.g}</div>`, 11), interactive: false }).addTo(poiLayer);
  }
}

function onNav() {
  const p = nav.pos;
  if (!map || !p) return;
  const ll = [p.lat, p.lon];
  if (!me) me = L.marker(ll, { icon: icon('<div class="pin-me"></div>', 10), interactive: false, zIndexOffset: 1000 }).addTo(map);
  else me.setLatLng(ll);
  if (follow) map.setView(ll, map.getZoom(), { animate: false });
  if (p.src === 'GPS') discover(p);
  drawTarget();
  hud();
  drawHeading();
}

async function actions() {
  sfx.select();
  const t = getTarget();
  const items = [
    { label: 'RECENTRER SUR MOI', value: 'center' },
    { label: 'MA POSITION = CENTRE CARTE', value: 'here' },
    { label: 'REPÈRE AU CENTRE', value: 'mark' },
    { label: 'GUIDER VERS LE CENTRE', value: 'goto' },
    ...(t ? [{ label: 'ARRÊTER LE GUIDAGE', value: 'stop' }] : []),
    { label: `LIEUX : ${state.settings.mapPois ? 'AFFICHÉS' : 'MASQUÉS'}`, value: 'pois' },
    { label: 'ACTUALISER POSITION', value: 'relocate' },
  ];
  const a = await menuBox('CARTE', items);
  if (!a || !map) return;
  const c = map.getCenter();
  const center = { lat: c.lat, lon: c.lng };
  if (a === 'center') {
    follow = true;
    if (nav.pos) map.setView([nav.pos.lat, nav.pos.lon], map.getZoom());
  } else if (a === 'here') {
    setManualPos(center);
    follow = true;
    setPos({ ...center, src: 'MANUEL', approx: true });
    toast('POSITION', 'DÉFINIE MANUELLEMENT\nEFFAÇABLE DANS MAP › REPÈRES');
  } else if (a === 'mark') {
    const name = await promptText('NOM DU REPÈRE', `REPÈRE ${state.waypoints.length + 1}`);
    if (!name) return;
    state.waypoints.push({ id: 'w' + Date.now(), name: name.toUpperCase().slice(0, 30), ...center });
    save();
    toast('REPÈRE AJOUTÉ', name.toUpperCase());
  } else if (a === 'goto') {
    setTarget({ name: 'POINT CARTE', ...center });
  } else if (a === 'stop') {
    setTarget(null);
  } else if (a === 'pois') {
    state.settings.mapPois = !state.settings.mapPois;
    save();
    drawPois();
  } else if (a === 'relocate') {
    toast('POSITION', 'RECHERCHE...');
    relocate();
  }
  hud();
}

export default {
  id: 'map',
  label: 'LOCALE',
  async mount(root) {
    el = document.createElement('div');
    el.style.cssText = 'position:absolute;inset:0';
    el.innerHTML = `<div class="map"></div><div class="cross">+</div>
      <div class="map-hud top"><span class="z"></span><span class="s"></span><span class="f"></span></div>
      <div class="tgt-bar"></div>
      <div class="map-hud bottom"><div style="display:flex;justify-content:space-between"><span class="c"></span><span class="hd">---</span></div>
        <div class="compass-strip"><div class="ticks">${[...STRIP, ...STRIP, ...STRIP].map((d) => `<span>${d}</span>`).join('')}</div><div class="strip-tgt">▼</div></div>
        <div class="osm">© OPENSTREETMAP</div></div>`;
    root.append(el);
    const mine = el;

    if (!L) {
      const [mod] = await Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]);
      L = mod.default;
    }
    if (el !== mine || !mine.isConnected) return;

    const start = nav.pos || state.lastPos || { lat: 48.8566, lon: 2.3522 };
    follow = true;
    map = L.map(el.querySelector('.map'), {
      zoomControl: false, scrollWheelZoom: false, keyboard: false, attributionControl: false, zoomSnap: 1,
    }).setView([start.lat, start.lon], 16);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    placeLayer = L.layerGroup().addTo(map);
    poiLayer = L.layerGroup().addTo(map);
    for (const p of state.places) L.marker([p.lat, p.lon], { icon: icon('<div class="pin-place"></div>', 6), interactive: false }).addTo(placeLayer);
    map.on('dragstart', () => { follow = false; hud(); });
    map.on('zoomend moveend', hud);
    setTimeout(() => map?.invalidateSize(), 50);

    me = null;
    offs = [on('nav', onNav), on('pois', drawPois), on('heading', drawHeading)];
    navStart();
    onNav();
    drawPois();
    hud();
    drawHeading();
    loadPois();
  },
  unmount() {
    // offs is only set once Leaflet loaded and navStart() ran.
    if (offs.length) navStop();
    offs.forEach((f) => f());
    offs = [];
    map?.remove();
    map = me = poiLayer = placeLayer = tgtMarker = tgtLine = null;
    el = null;
  },
  onScroll(d) {
    if (!map) return;
    map.setZoom(map.getZoom() - d);
    sfx.tick();
  },
  onClick() {
    if (map) actions();
  },
};
