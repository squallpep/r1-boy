// MAP: OpenStreetMap tiles tinted to phosphor, player marker, auto-discovered places, compass strip.
import { state, save } from '../../core/store.js';
import { addXp } from '../../core/xp.js';
import { getPosition, distance, gpsUsable } from '../../core/geo.js';
import { onHeading } from '../../core/sensors.js';
import { sfx } from '../../core/sfx.js';
import { pad } from '../../ui/ui.js';
import { dirName } from '../inv/views.js';

const DISCOVER_RADIUS = 300; // meters between two discovered places
const STRIP = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];

let L, map, me, watch, offHeading, el, follow = true, pos = null;

function placeIcon() {
  return L.divIcon({ className: '', html: '<div class="pin-place"></div>', iconSize: [6, 6] });
}

function discover(p) {
  if (state.places.some((q) => distance(q, p) < DISCOVER_RADIUS)) return;
  const place = { lat: p.lat, lon: p.lon, t: Date.now() };
  state.places.push(place);
  save();
  L.marker([p.lat, p.lon], { icon: placeIcon(), interactive: false }).addTo(map);
  addXp(10, 'LIEU DÉCOUVERT', `LIEU N°${state.places.length} · +10 XP`);
}

function hud() {
  if (!el) return;
  el.querySelector('.z').textContent = `ZOOM ${map.getZoom()}`;
  el.querySelector('.f').textContent = follow ? 'SUIVI ●' : 'LIBRE ○';
  el.querySelector('.c').textContent = pos
    ? `${pos.lat.toFixed(4)} ${pos.lon.toFixed(4)}${pos.fallback ? ' DÉFAUT' : pos.approx ? ' ~IP' : ' GPS'}`
    : 'RECHERCHE GPS...';
  el.querySelector(".p").textContent = `© OSM · LIEUX ${state.places.length}`;
}

function setHeading(h) {
  const ticks = el.querySelector('.ticks');
  // Each label is 22px wide and spans 45°; the strip repeats so the centre can wrap.
  const x = (h / 45) * 22 + 8 * 22 + 11;
  ticks.style.left = `calc(50% - ${x}px)`;
  el.querySelector('.hd').textContent = `${dirName(h)} ${pad(Math.round(h), 3)}°`;
}

function update(p) {
  pos = p;
  const ll = [p.lat, p.lon];
  if (!me) {
    me = L.marker(ll, { icon: L.divIcon({ className: '', html: '<div class="pin-me"></div>', iconSize: [10, 10] }), interactive: false }).addTo(map);
  } else {
    me.setLatLng(ll);
  }
  if (follow) map.setView(ll, map.getZoom(), { animate: false });
  if (!p.fallback && !p.approx) discover(p);
  hud();
}

export default {
  id: 'map',
  label: 'CARTE LOCALE',
  async mount(root) {
    el = document.createElement('div');
    el.className = 'map-root';
    el.style.cssText = 'position:absolute;inset:0';
    el.innerHTML = `<div class="map"></div>
      <div class="map-hud top"><span class="z"></span><span class="p"></span><span class="f"></span></div>
      <div class="map-hud bottom"><div style="display:flex;justify-content:space-between"><span class="c"></span><span class="hd">---</span></div>
        <div class="compass-strip"><div class="ticks">${[...STRIP, ...STRIP, ...STRIP].map((d) => `<span>${d}</span>`).join('')}</div></div></div>`;
    root.append(el);
    const mine = el;

    if (!L) {
      const [mod] = await Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]);
      L = mod.default;
    }
    if (el !== mine || !mine.isConnected) return;

    const start = state.lastPos || { lat: 48.8566, lon: 2.3522 };
    map = L.map(el.querySelector('.map'), {
      zoomControl: false,
      scrollWheelZoom: false,
      keyboard: false,
      attributionControl: false,
      zoomSnap: 1,
    }).setView([start.lat, start.lon], 16);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map);
    map.on('dragstart', () => { follow = false; hud(); });
    map.on('zoomend', hud);
    for (const p of state.places) L.marker([p.lat, p.lon], { icon: placeIcon(), interactive: false }).addTo(map);
    setTimeout(() => map?.invalidateSize(), 50);

    me = null;
    hud();
    setHeading(0);
    getPosition().then((p) => map && update(p));
    if (gpsUsable()) watch = navigator.geolocation.watchPosition(
      (p) => map && update({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000 },
    );
    offHeading = onHeading(setHeading);
  },
  unmount() {
    if (watch != null) navigator.geolocation.clearWatch(watch);
    watch = null;
    offHeading?.();
    offHeading = null;
    map?.remove();
    map = null;
    me = null;
    el = null;
  },
  onScroll(d) {
    if (!map) return;
    map.setZoom(map.getZoom() - d);
    sfx.tick();
  },
  onClick() {
    if (!map) return;
    follow = true;
    if (pos) map.setView([pos.lat, pos.lon], map.getZoom());
    sfx.select();
    hud();
  },
};
