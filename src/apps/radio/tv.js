// RADIO > TV: IPTV from an M3U playlist, HLS via hls.js, phosphor CRT filter on the picture.
import { state, save, on } from '../../core/store.js';
import { checkPerks } from '../../core/xp.js';
import { sfx } from '../../core/sfx.js';
import { List } from '../../ui/list.js';
import { esc, toast } from '../../ui/ui.js';
import { isPlaying, stop as stopRadio } from './player.js';

const MAX_CHANNELS = 800;
const FILTER = { filter: true }; // first list row: phosphor / natural picture toggle
let channels = null;
let loadedUrl = null;
let root, list, video, hls, playingIdx = -1, fs = false, failT, staticH, offIptv, offVol;

function parseM3U(text) {
  const out = [];
  let cur = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('#EXTINF')) {
      cur = {
        name: line.slice(line.lastIndexOf(',') + 1).trim() || 'CANAL',
        group: /group-title="([^"]*)"/.exec(line)?.[1] || '',
      };
    } else if (line && !line.startsWith('#') && cur) {
      cur.url = line;
      out.push(cur);
      cur = null;
    }
  }
  // An https page cannot load http streams (mixed content).
  return out
    .filter((c) => location.protocol !== 'https:' || c.url.startsWith('https://'))
    .slice(0, MAX_CHANNELS)
    .map((c, n) => ({ ...c, n }));
}

const msg = (html) => {
  const m = root.querySelector('.tv-msg');
  m.innerHTML = html || '';
  m.style.display = html ? 'flex' : 'none';
};

function cleanupStream() {
  clearTimeout(failT);
  staticH?.stop();
  staticH = null;
  hls?.destroy();
  hls = null;
  if (video) {
    video.pause();
    video.removeAttribute('src');
    video.load();
  }
}

function fail() {
  cleanupStream();
  sfx.error();
  msg('SIGNAL PERDU<br><span class="hint">ESSAYEZ UNE AUTRE CHAÎNE</span>');
}

async function playChannel(i) {
  const ch = channels[i];
  if (!ch) return;
  cleanupStream();
  if (isPlaying()) stopRadio();
  playingIdx = i;
  list?.render();
  msg(`SYNTONISATION...<br><span class="hint">${esc(ch.name)}</span>`);
  staticH = sfx.static(0.08);
  failT = setTimeout(fail, 15000);
  try {
    const { default: Hls } = await import('hls.js');
    if (playingIdx !== i || !video) return;
    if (/\.m3u8?(\?|$)/i.test(ch.url) && Hls.isSupported()) {
      hls = new Hls({ maxBufferLength: 10 });
      hls.loadSource(ch.url);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) fail(); });
    } else {
      video.src = ch.url;
    }
    video.play().catch(() => {});
  } catch {
    fail();
  }
}

function setFs(v) {
  fs = v;
  root.classList.toggle('fs', fs);
  sfx.tab();
  if (fs) toast('PLEIN ÉCRAN', 'MOLETTE : ZAPPER · CLIC : FILTRE\nAPPUI LONG : RETOUR', { ms: 1500 });
}

function toggleFilter() {
  state.settings.tvFilter = !state.settings.tvFilter;
  save();
  root.querySelector('.tv-wrap').classList.toggle('phos', state.settings.tvFilter);
  list.render();
  sfx.select();
  if (fs) toast('IMAGE', state.settings.tvFilter ? 'PHOSPHORE' : 'NATURELLE', { ms: 900 });
}

async function loadChannels() {
  const url = state.settings.iptvUrl;
  if (channels && loadedUrl === url) return showList();
  msg('CHARGEMENT DU GUIDE...');
  try {
    const text = await (await fetch(url)).text();
    channels = parseM3U(text);
    loadedUrl = url;
  } catch {
    channels = null;
    return msg('GUIDE INDISPONIBLE<br><span class="hint">VÉRIFIEZ L\'URL DANS DATA > CONFIG</span>');
  }
  if (!root?.isConnected) return;
  showList();
}

function showList() {
  msg(channels.length ? 'CLIC : REGARDER LA CHAÎNE' : 'AUCUNE CHAÎNE COMPATIBLE');
  list.setItems([FILTER, ...channels]);
}

export default {
  id: 'tv',
  label: 'TV',
  mount(el) {
    fs = false;
    playingIdx = -1;
    root = document.createElement('div');
    root.className = 'tv-screen';
    root.innerHTML = `<div class="tv-wrap ${state.settings.tvFilter ? 'phos' : ''}"><video playsinline></video><div class="tv-msg"></div></div><div class="tv-list"></div>`;
    el.append(root);
    video = root.querySelector('video');
    video.volume = state.settings.volume ?? 0.8;
    video.addEventListener('playing', () => {
      clearTimeout(failT);
      staticH?.stop();
      staticH = null;
      msg('');
      if (!state.stats.tvWatched) {
        state.stats.tvWatched = true;
        save();
        checkPerks();
      }
    });
    video.addEventListener('error', () => { if (video.getAttribute('src')) fail(); });
    list = new List(root.querySelector('.tv-list'), {
      label: (c) => (c.filter
        ? `◐ IMAGE : ${state.settings.tvFilter ? 'PHOSPHORE' : 'NATURELLE'}`
        : `${c.n === playingIdx ? '▶' : String(c.n + 1).padStart(3, '0')} ${esc(c.name)}`),
      onSelect: (c) => {
        if (c.filter) return toggleFilter();
        if (c.n === playingIdx) return setFs(true);
        sfx.select();
        playChannel(c.n);
      },
      empty: '...',
    });
    root.querySelector('.tv-list').style.cssText = 'flex:1;min-height:0';
    root.querySelector('.tv-wrap').addEventListener('click', () => playingIdx >= 0 && setFs(!fs));
    offIptv = on('iptv', () => { channels = null; });
    offVol = on('volume', (v) => { if (video) video.volume = v; });
    loadChannels();
  },
  unmount() {
    cleanupStream();
    offIptv();
    offVol();
    video = null;
    root = null;
  },
  onScroll(d) {
    if (!fs) return list.move(d);
    // Zapping in full screen.
    if (!channels?.length) return;
    const i = (playingIdx + d + channels.length) % channels.length;
    list.idx = i + 1; // row 0 is the filter toggle
    sfx.tick();
    playChannel(i);
  },
  onClick() {
    if (fs) return toggleFilter();
    list.select();
  },
  onBack() {
    if (!fs) return false;
    setFs(false);
    return true;
  },
};
