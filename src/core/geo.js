// Position sources, best first: device GPS (https + permission), manual position set on the map,
// the rabbit LLM (knows the R1 location), IP geolocation (city level), last known, Paris.
import { state, save } from './store.js';
import { askLLM, llmAvailable } from './llm.js';

const PARIS = { lat: 48.8566, lon: 2.3522, src: 'DÉFAUT', fallback: true };

export const gpsUsable = () => !!navigator.geolocation && window.isSecureContext;
export const gpsStatus = { state: '...' };

function gps(timeout) {
  return new Promise((resolve) => {
    if (!gpsUsable()) {
      gpsStatus.state = window.isSecureContext ? 'ABSENT' : 'HTTP';
      return resolve(null);
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        gpsStatus.state = 'OK';
        resolve({ lat: p.coords.latitude, lon: p.coords.longitude, src: 'GPS' });
      },
      (e) => {
        gpsStatus.state = e.code === 1 ? 'REFUSÉ' : 'INDISPONIBLE';
        resolve(null);
      },
      { timeout, maximumAge: 60 * 1000, enableHighAccuracy: true },
    );
  });
}

let r1Cache = null;
async function r1Location() {
  if (!llmAvailable()) return null;
  if (r1Cache && Date.now() - r1Cache.t < 10 * 60 * 1000) return r1Cache.p;
  try {
    const { obj } = await askLLM(
      'Quelle est la position géographique actuelle de cet appareil r1 ? Réponds UNIQUEMENT avec du JSON valide '
      + 'au format {"lat":48.85,"lon":2.35,"city":"Paris"} avec la position la plus précise que tu connais.',
      { timeout: 20000 },
    );
    const lat = Number(obj?.lat);
    const lon = Number(obj?.lon);
    if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || (lat === 0 && lon === 0)) return null;
    const p = { lat, lon, city: obj.city, src: 'R1', approx: true };
    r1Cache = { t: Date.now(), p };
    return p;
  } catch {
    return null;
  }
}

async function ipLocation() {
  try {
    const r = await (await fetch('https://get.geojs.io/v1/ip/geo.json')).json();
    const lat = parseFloat(r.latitude);
    const lon = parseFloat(r.longitude);
    if (isNaN(lat) || isNaN(lon)) return null;
    return { lat, lon, city: r.city, src: 'IP', approx: true };
  } catch {
    return null;
  }
}

export async function getPosition(timeout = 8000) {
  const g = await gps(timeout);
  if (g) {
    state.lastPos = { lat: g.lat, lon: g.lon };
    save();
    return g;
  }
  if (state.manualPos) return { ...state.manualPos, src: 'MANUEL', approx: true };
  const p = (await r1Location()) || (await ipLocation());
  if (p) {
    state.lastPos = { lat: p.lat, lon: p.lon };
    save();
    return p;
  }
  return state.lastPos ? { ...state.lastPos, src: 'MÉMOIRE', fallback: true } : PARIS;
}

export function setManualPos(p) {
  state.manualPos = p ? { lat: p.lat, lon: p.lon } : null;
  save();
}

// Great-circle distance in meters.
export function distance(a, b) {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const fmtDist = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} M` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} KM`);
