// DATA > MÉTÉO: Open-Meteo forecast shown as an atmospheric report, UV index as "RAD".
import { state, save } from '../../core/store.js';
import { checkPerks } from '../../core/xp.js';
import { getPosition } from '../../core/geo.js';
import { sfx } from '../../core/sfx.js';
import { List } from '../../ui/list.js';
import { icons } from '../../ui/icons.js';
import { esc, bar } from '../../ui/ui.js';

function wmo(code) {
  if (code === 0) return ['CIEL DÉGAGÉ', 'sun'];
  if (code <= 2) return ['PEU NUAGEUX', 'partly'];
  if (code === 3) return ['COUVERT', 'cloud'];
  if (code <= 48) return ['BROUILLARD', 'fog'];
  if (code <= 57) return ['BRUINE', 'rain'];
  if (code <= 67) return ['PLUIE', 'rain'];
  if (code <= 77) return ['NEIGE', 'snow'];
  if (code <= 82) return ['AVERSES', 'rain'];
  if (code <= 86) return ['AVERSES DE NEIGE', 'snow'];
  return ['ORAGE', 'storm'];
}

const uvLabel = (uv) => (uv < 3 ? 'FAIBLE' : uv < 6 ? 'MODÉRÉ' : uv < 8 ? 'ÉLEVÉ' : 'DANGER');
let cache = null; // { t, data, place }
let el, list;

async function fetchWeather() {
  const pos = await getPosition();
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + pos.lat + '&longitude=' + pos.lon +
    '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,uv_index' +
    '&hourly=temperature_2m&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_probability_max' +
    '&timezone=auto&forecast_days=6';
  const data = await (await fetch(url)).json();
  let place = pos.src === 'DÉFAUT' ? 'PARIS (PAR DÉFAUT)'
    : pos.city ? `${pos.city.toUpperCase()} (${pos.src})` : `${pos.lat.toFixed(2)}, ${pos.lon.toFixed(2)}`;
  if (!pos.city && pos.src !== 'DÉFAUT') {
    try {
      const r = await (await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=10&lat=${pos.lat}&lon=${pos.lon}&accept-language=fr`)).json();
      const a = r.address || {};
      place = (a.city || a.town || a.village || a.municipality || place).toUpperCase();
    } catch {}
  }
  return { t: Date.now(), data, place };
}

function sparkline(temps) {
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const span = max - min || 1;
  const pts = temps.map((v, i) => `${(i / (temps.length - 1)) * 120},${26 - ((v - min) / span) * 22}`).join(' ');
  return `<svg viewBox="0 0 120 30" width="100%" height="30" fill="none" stroke="currentColor" stroke-width="1.2">
    <path d="M0 29.5h120" stroke-width=".5" opacity=".5"/><polyline points="${pts}"/></svg>
    <div class="hint" style="display:flex;justify-content:space-between"><span>24 H</span><span>${Math.round(min)}° / ${Math.round(max)}°</span></div>`;
}

function detailNow(d) {
  const c = d.current;
  const [txt, ic] = wmo(c.weather_code);
  const h = new Date().getHours();
  const temps = d.hourly.temperature_2m.slice(h, h + 24);
  return `<div style="display:flex;align-items:center;gap:6px">${icons[ic]}<span class="big">${Math.round(c.temperature_2m)}°C</span></div>
    <div class="h">${txt}</div>
    <div class="row"><span>RESSENTI</span><b>${Math.round(c.apparent_temperature)}°</b></div>
    <div class="row"><span>HUMIDITÉ</span><b>${c.relative_humidity_2m}%</b></div>
    <div class="row"><span>VENT</span><b>${Math.round(c.wind_speed_10m)} KM/H</b></div>
    <div class="row ${c.uv_index >= 6 ? 'hl' : ''}"><span>RAD (UV)</span><b>${c.uv_index.toFixed(1)} ${uvLabel(c.uv_index)}</b></div>
    ${bar(c.uv_index / 11, 'thin')}
    ${sparkline(temps)}`;
}

function detailDay(d, i) {
  const dl = d.daily;
  const [txt, ic] = wmo(dl.weather_code[i]);
  const uv = dl.uv_index_max[i] ?? 0;
  return `<div style="display:flex;align-items:center;gap:6px">${icons[ic]}<span class="big">${Math.round(dl.temperature_2m_max[i])}°</span><span class="dim">/ ${Math.round(dl.temperature_2m_min[i])}°</span></div>
    <div class="h">${txt}</div>
    <div class="row"><span>MAX</span><b>${Math.round(dl.temperature_2m_max[i])}°C</b></div>
    <div class="row"><span>MIN</span><b>${Math.round(dl.temperature_2m_min[i])}°C</b></div>
    <div class="row"><span>PRÉCIP.</span><b>${dl.precipitation_probability_max[i] ?? 0}%</b></div>
    <div class="row ${uv >= 6 ? 'hl' : ''}"><span>RAD MAX</span><b>${uv.toFixed(1)} ${uvLabel(uv)}</b></div>
    ${uv >= 6 ? '<div class="hint" style="animation:blink 1s steps(1) infinite">⚠ ALERTE CONTAMINATION UV</div>' : ''}`;
}

function show() {
  const { data, place } = cache;
  const days = data.daily.time.map((t, i) => ({
    i,
    label: i === 0 ? "AUJOURD'HUI" : new Date(t + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit' }).toUpperCase(),
  }));
  el.innerHTML = '';
  list = new List(el, {
    width: 84,
    label: (it) => it.label,
    detail: (it) => (it.now ? detailNow(data) : detailDay(data, it.i)) + `<div class="hint" style="position:absolute;bottom:2px">⌖ ${esc(place)}</div>`,
  });
  list.setItems([{ now: true, label: 'MAINTENANT' }, ...days]);
}

async function refresh(force) {
  if (!force && cache && Date.now() - cache.t < 15 * 60 * 1000) return show();
  list = null;
  el.innerHTML = `<div class="tool-view"><div class="h">RAPPORT ATMOSPHÉRIQUE</div><div class="cursor-line">ACQUISITION DU SIGNAL<span style="animation:blink .6s steps(1) infinite">_</span></div></div>`;
  try {
    cache = await fetchWeather();
    if (!el.isConnected) return;
    state.stats.weatherChecked = true;
    save();
    checkPerks();
    show();
  } catch {
    if (!el.isConnected) return;
    sfx.error();
    el.innerHTML = `<div class="tool-view"><div class="h">SIGNAL PERDU</div><div class="hint">VÉRIFIEZ LA CONNEXION · CLIC : RÉESSAYER</div></div>`;
  }
}

export default {
  id: 'meteo',
  label: 'MÉTÉO',
  mount(root) {
    el = document.createElement('div');
    el.style.height = '100%';
    root.append(el);
    refresh(false);
  },
  onScroll: (d) => list?.move(d),
  onClick() {
    sfx.select();
    refresh(true);
  },
};
