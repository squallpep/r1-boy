// Shared navigation state for the MAP screens: position, heading, nearby places, guidance target.
import { state, save, emit } from '../../core/store.js';
import { getPosition, gpsUsable, distance } from '../../core/geo.js';
import { onHeading, bearing } from '../../core/sensors.js';

const RADIUS = 1000; // meters scanned around the user
// Nominatim searches (one per place type), run 1 per second per the usage policy.
const SEARCHES = [
  ['med', 'pharmacy'], ['med', 'hospital'], ['shop', 'supermarket'], ['shop', 'bakery'],
  ['food', 'restaurant'], ['food', 'cafe'], ['bank', 'atm'], ['bank', 'bank'],
  ['fuel', 'fuel'], ['fuel', 'charging station'], ['transit', 'railway station'], ['transit', 'tram stop'],
  ['svc', 'toilets'], ['svc', 'post office'], ['park', 'parking'],
];
// Categories with Pip-Boy flavored names and a one-character map glyph.
export const CATS = [
  { id: 'med', name: 'MÉDECIN', g: '+', match: (t) => /^(pharmacy|hospital|doctors|clinic|dentist)$/.test(t.amenity) },
  { id: 'shop', name: 'MARCHAND', g: '$', match: (t) => /^(supermarket|convenience|bakery|butcher|greengrocer)$/.test(t.shop) },
  { id: 'food', name: 'CANTINE', g: '#', match: (t) => /^(restaurant|fast_food|cafe|bar|pub)$/.test(t.amenity) },
  { id: 'bank', name: 'BANQUE', g: '€', match: (t) => /^(atm|bank)$/.test(t.amenity) },
  { id: 'fuel', name: 'CARBURANT', g: 'E', match: (t) => /^(fuel|charging_station)$/.test(t.amenity) },
  { id: 'transit', name: 'TRANSPORT', g: 'T', match: (t) => /^(station|tram_stop)$/.test(t.railway) || t.station === 'subway' || t.amenity === 'bus_station' },
  { id: 'svc', name: 'SERVICES', g: 'i', match: (t) => /^(toilets|drinking_water|post_office|police|townhall)$/.test(t.amenity) },
  { id: 'park', name: 'PARKING', g: 'P', match: (t) => t.amenity === 'parking' },
];

const TYPE_FR = {
  pharmacy: 'PHARMACIE', hospital: 'HÔPITAL', doctors: 'MÉDECIN', clinic: 'CLINIQUE', dentist: 'DENTISTE',
  supermarket: 'SUPERMARCHÉ', convenience: 'ÉPICERIE', bakery: 'BOULANGERIE', butcher: 'BOUCHERIE', greengrocer: 'PRIMEUR',
  restaurant: 'RESTAURANT', fast_food: 'RESTAURATION RAPIDE', cafe: 'CAFÉ', bar: 'BAR', pub: 'PUB',
  atm: 'DISTRIBUTEUR', bank: 'BANQUE', fuel: 'STATION-SERVICE', charging_station: 'BORNE DE RECHARGE',
  station: 'GARE', tram_stop: 'ARRÊT DE TRAM', subway: 'MÉTRO', bus_station: 'GARE ROUTIÈRE',
  toilets: 'TOILETTES', drinking_water: 'EAU POTABLE', post_office: 'BUREAU DE POSTE', police: 'POLICE',
  townhall: 'MAIRIE', parking: 'PARKING',
};

export const nav = { pos: null, heading: null, pois: null, poisAt: null, poisErr: false, loadingPois: false };

let subs = 0;
let watchId = null;
let offHeading = null;
let lastHeadingEmit = 0;

export function setPos(p) {
  nav.pos = p;
  emit('nav');
  loadPois();
}

async function locate() {
  const p = await getPosition();
  // A live GPS fix from the watch is better than anything getPosition returns later.
  if (subs && (nav.pos?.src !== 'GPS' || p.src === 'GPS')) setPos(p);
}

export function navStart() {
  if (subs++) return;
  locate();
  if (gpsUsable()) {
    watchId = navigator.geolocation.watchPosition(
      (p) => setPos({ lat: p.coords.latitude, lon: p.coords.longitude, src: 'GPS' }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000 },
    );
  }
  offHeading = onHeading((h) => {
    nav.heading = h;
    const now = performance.now();
    if (now - lastHeadingEmit > 150) {
      lastHeadingEmit = now;
      emit('heading');
    }
  });
}

export function navStop() {
  if (--subs) return;
  if (watchId != null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  offHeading?.();
  offHeading = null;
}

export const relocate = () => locate();

let scanGen = 0;

export async function loadPois(force = false) {
  const p = nav.pos;
  if (!p || (nav.loadingPois && !force)) return;
  if (!force && nav.poisAt && distance(nav.poisAt, p) < 400) return;
  const gen = ++scanGen;
  nav.loadingPois = true;
  nav.poisErr = false;
  nav.pois = [];
  nav.poisAt = { ...p };
  emit('pois');
  const dLat = RADIUS / 111000;
  const dLon = dLat / Math.cos((p.lat * Math.PI) / 180);
  const box = `${p.lon - dLon},${p.lat + dLat},${p.lon + dLon},${p.lat - dLat}`;
  const seen = new Set();
  let ok = 0;
  for (const [catId, term] of SEARCHES) {
    if (gen !== scanGen) return; // position changed, a newer scan took over
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&bounded=1&limit=15&extratags=1&addressdetails=1&accept-language=fr&viewbox=${box}&q=${encodeURIComponent(term)}`;
      const res = await (await fetch(url)).json();
      ok++;
      for (const r of res) {
        const id = r.osm_type + r.osm_id;
        if (seen.has(id)) continue;
        seen.add(id);
        const t = { [r.category]: r.type };
        const cat = CATS.find((c) => c.match(t)) || CATS.find((c) => c.id === catId);
        const type = TYPE_FR[r.type] || cat.name;
        const a = r.address || {};
        const x = r.extratags || {};
        nav.pois.push({
          id, lat: +r.lat, lon: +r.lon, cat, type,
          name: (r.name || type).toUpperCase(),
          addr: [a.house_number, a.road].filter(Boolean).join(' '),
          hours: x.opening_hours, phone: x.phone || x['contact:phone'],
        });
      }
      emit('pois');
    } catch {}
    await new Promise((r) => setTimeout(r, 1100));
  }
  if (gen !== scanGen) return;
  nav.loadingPois = false;
  nav.poisErr = ok === 0;
  emit('pois');
}

// Distance, absolute bearing and bearing relative to where the R1 points.
export function navInfo(target) {
  if (!nav.pos) return null;
  const d = distance(nav.pos, target);
  const b = bearing(nav.pos, target);
  const rel = nav.heading == null ? null : (b - nav.heading + 360) % 360;
  return { d, b, rel };
}

export const getTarget = () => state.navTarget || null;

export function setTarget(t) {
  state.navTarget = t ? { name: t.name, lat: t.lat, lon: t.lon } : null;
  save();
  emit('nav');
}

export const isTarget = (p) => {
  const t = getTarget();
  return !!t && Math.abs(t.lat - p.lat) < 1e-7 && Math.abs(t.lon - p.lon) < 1e-7;
};

// Guidance arrow: rotates by the relative bearing (or absolute bearing, north-up, without compass).
export function arrowSvg(deg, size = 36) {
  return `<svg class="nav-arrow" viewBox="0 0 40 40" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6">
    <circle cx="20" cy="20" r="18" opacity=".45"/>
    <path d="M20 4 L28 27 L20 22 L12 27 Z" fill="currentColor" style="transform:rotate(${deg}deg);transform-origin:20px 20px;transition:transform .2s"/></svg>`;
}
