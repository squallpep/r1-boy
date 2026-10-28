// Global radio player: keeps playing across tabs, static between stations, analyser when CORS allows.
import { state, save, emit } from '../../core/store.js';
import { checkPerks } from '../../core/xp.js';
import { sfx } from '../../core/sfx.js';

const SERVERS = ['https://de1.api.radio-browser.info', 'https://fi1.api.radio-browser.info', 'https://de2.api.radio-browser.info'];

export const player = {
  station: null, // { name, url, ... }
  status: 'stop', // stop | tuning | play | error
  analyser: null,
};

let audio = null;
let staticH = null;
let minuteInt = null;
let mediaSrc = null;

export async function searchStations(params) {
  const q = new URLSearchParams({ hidebroken: 'true', order: 'votes', reverse: 'true', limit: '12', ...params });
  for (const base of SERVERS) {
    try {
      const r = await fetch(`${base}/json/stations/search?${q}`);
      if (!r.ok) continue;
      const list = await r.json();
      return list
        .filter((s) => s.url_resolved?.startsWith('https://'))
        .map((s) => ({ name: s.name.trim(), url: s.url_resolved, country: s.countrycode, codec: s.codec, bitrate: s.bitrate }));
    } catch {}
  }
  throw new Error('radio-browser unreachable');
}

function set(status) {
  player.status = status;
  emit('radio');
}

function stopStatic() {
  staticH?.stop();
  staticH = null;
}

function attachAnalyser() {
  // Only works when the stream sends CORS headers (crossOrigin='anonymous').
  if (mediaSrc || !audio.crossOrigin) return;
  try {
    const ctx = sfx.context;
    mediaSrc = ctx.createMediaElementSource(audio);
    player.analyser = ctx.createAnalyser();
    player.analyser.fftSize = 512;
    mediaSrc.connect(player.analyser);
    player.analyser.connect(ctx.destination);
  } catch {
    player.analyser = null;
  }
}

function newAudio(cors) {
  audio?.pause();
  if (audio) audio.removeAttribute('src');
  audio = new Audio();
  mediaSrc = null;
  player.analyser = null;
  if (cors) audio.crossOrigin = 'anonymous';
  audio.preload = 'none';
  return audio;
}

export function play(station) {
  stop(true);
  player.station = station;
  set('tuning');
  staticH = sfx.static();
  const attempt = (cors) => {
    const a = newAudio(cors);
    a.src = station.url;
    a.addEventListener('playing', () => {
      if (a !== audio) return;
      stopStatic();
      set('play');
    });
    a.addEventListener('error', () => {
      if (a !== audio) return;
      if (cors) return attempt(false); // retry without CORS (no analyser)
      stopStatic();
      set('error');
    });
    if (cors) attachAnalyser();
    a.play().catch(() => {});
  };
  attempt(true);
  clearInterval(minuteInt);
  minuteInt = setInterval(() => {
    if (player.status !== 'play') return;
    state.stats.radioMinutes++;
    save();
    checkPerks();
  }, 60000);
}

export function stop(silent) {
  stopStatic();
  clearInterval(minuteInt);
  if (audio) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }
  if (!silent) {
    player.station = null;
    set('stop');
  }
}

export const isPlaying = () => player.status === 'play' || player.status === 'tuning';
