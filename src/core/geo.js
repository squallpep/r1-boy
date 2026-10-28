// Position: device GPS (needs https), else IP geolocation (city level), else last known, else Paris.
import { state, save } from './store.js';

const PARIS = { lat: 48.8566, lon: 2.3522, fallback: true };

export const gpsUsable = () => !!navigator.geolocation && window.isSecureContext;

function gps(timeout) {
  return new Promise((resolve) => {
    if (!gpsUsable()) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => resolve(null),
      { timeout, maximumAge: 5 * 60 * 1000, enableHighAccuracy: false },
    );
  });
}

async function ipLocation() {
  try {
    const r = await (await fetch('https://get.geojs.io/v1/ip/geo.json')).json();
    const lat = parseFloat(r.latitude);
    const lon = parseFloat(r.longitude);
    if (isNaN(lat) || isNaN(lon)) return null;
    return { lat, lon, approx: true, city: r.city };
  } catch {
    return null;
  }
}

export async function getPosition(timeout = 8000) {
  const p = (await gps(timeout)) || (await ipLocation());
  if (p) {
    state.lastPos = { lat: p.lat, lon: p.lon };
    save();
    return p;
  }
  return state.lastPos ? { ...state.lastPos, fallback: true } : PARIS;
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
