// Persistent state: R1 creationStorage (base64) with localStorage as a fallback/backup.
const KEY = 'r1boy.v1';

const DEFAULTS = {
  xp: 0,
  settings: {
    theme: 'green',
    sound: true,
    pedometer: true,
    tvFilter: true,
    aiVoice: true,
    iptvUrl: 'https://iptv-org.github.io/iptv/languages/fra.m3u',
    customRadio: '',
  },
  stats: {
    day: '',
    stepsToday: 0,
    stepsTotal: 0,
    stepsXpBank: 0,
    questsDone: 0,
    radioMinutes: 0,
    tvWatched: false,
    weatherChecked: false,
    nightOwl: false,
    boots: 0,
  },
  places: [],
  quests: [
    { id: 'd-steps', title: 'MARCHER 10 000 PAS', type: 'daily', auto: 'steps', done: false },
    { id: 'd-water', title: "BOIRE 2 L D'EAU", type: 'daily', done: false },
    { id: 'd-read', title: 'LIRE 20 MINUTES', type: 'daily', done: false },
    { id: 'm-start', title: 'EXPLORER LE R1-BOY', type: 'main', done: false },
  ],
  perks: {},
  ui: { tab: 0, sub: 0 },
};

export const state = structuredClone(DEFAULTS);

const listeners = new Map();
export function on(evt, fn) {
  if (!listeners.has(evt)) listeners.set(evt, new Set());
  listeners.get(evt).add(fn);
  return () => listeners.get(evt).delete(fn);
}
export function emit(evt, data) {
  listeners.get(evt)?.forEach((fn) => fn(data));
}

const enc = (s) => btoa(unescape(encodeURIComponent(s)));
const dec = (s) => decodeURIComponent(escape(atob(s)));
const cs = () => window.creationStorage?.plain;

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
function merge(target, src) {
  for (const k of Object.keys(src)) {
    if (isObj(src[k]) && isObj(target[k])) merge(target[k], src[k]);
    else target[k] = src[k];
  }
}

export async function load() {
  let raw = null;
  try {
    const v = cs() && (await cs().getItem(KEY));
    if (v) raw = dec(v);
  } catch {}
  if (!raw) {
    try { raw = localStorage.getItem(KEY); } catch {}
  }
  if (raw) {
    try { merge(state, JSON.parse(raw)); } catch {}
  }
}

let timer;
export function save() {
  clearTimeout(timer);
  timer = setTimeout(flush, 400);
}

export async function flush() {
  const raw = JSON.stringify(state);
  try { localStorage.setItem(KEY, raw); } catch {}
  try { if (cs()) await cs().setItem(KEY, enc(raw)); } catch {}
}

export async function reset() {
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, structuredClone(DEFAULTS));
  await flush();
}

// Local date as YYYY-MM-DD.
export const today = () => new Date().toLocaleDateString('sv');
