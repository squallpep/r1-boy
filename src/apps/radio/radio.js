// RADIO > STATIONS: themed frequencies resolved via radio-browser.info, oscilloscope on the right.
import { state, on } from '../../core/store.js';
import { sfx } from '../../core/sfx.js';
import { List } from '../../ui/list.js';
import { esc, toast } from '../../ui/ui.js';
import { player, play, stop, searchStations } from './player.js';

const PRESETS = [
  { name: 'JAZZ RÉTRO', freq: '88.4', q: { tag: 'jazz' } },
  { name: 'SWING 40S', freq: '90.1', q: { tag: 'swing' } },
  { name: 'OLDIES', freq: '92.7', q: { tag: 'oldies' } },
  { name: 'CLASSIQUE', freq: '94.3', q: { tag: 'classical' } },
  { name: 'LO-FI', freq: '96.6', q: { tag: 'lofi' } },
  { name: 'SYNTHWAVE', freq: '98.2', q: { tag: 'synthwave' } },
  { name: 'ROCK', freq: '100.5', q: { tag: 'rock' } },
  { name: 'COUNTRY', freq: '102.1', q: { tag: 'country' } },
  { name: 'AMBIENT', freq: '104.8', q: { tag: 'ambient' } },
  { name: 'INFOS FR', freq: '106.3', q: { tag: 'news', countrycode: 'FR' } },
];
const CUSTOM = { name: 'RADIO PERSO', freq: '107.9', custom: true };

let list, offs = [], raf;
let current = null; // preset being played
const tries = new Map(); // preset -> index of candidate

// Auto-retune to the next candidate when a stream fails.
on('radio', () => {
  if (player.status !== 'error' || !current?.candidates) return;
  const i = (tries.get(current) ?? 0) + 1;
  if (i < Math.min(current.candidates.length, 5)) {
    tries.set(current, i);
    play(current.candidates[i]);
  } else {
    toast('SIGNAL PERDU', current.name);
  }
});

async function tune(p) {
  if (current === p && player.status !== 'stop' && player.status !== 'error') {
    stop();
    current = null;
    sfx.back();
    return;
  }
  sfx.select();
  current = p;
  if (p.custom) {
    if (!state.settings.customRadio) return toast('RADIO PERSO', 'AJOUTEZ UNE URL DANS DATA > CONFIG');
    return play({ name: 'FLUX PERSONNEL', url: state.settings.customRadio });
  }
  if (!p.candidates) {
    player.status = 'tuning';
    list.render();
    try {
      p.candidates = await searchStations(p.q);
    } catch {
      player.status = 'error';
      list?.render();
      return toast('SIGNAL PERDU', 'ANNUAIRE RADIO INJOIGNABLE');
    }
    if (current !== p) return;
    if (!p.candidates.length) return toast('AUCUNE STATION', p.name);
  }
  // Start on a random top station so each listen feels different.
  const i = Math.floor(Math.random() * Math.min(3, p.candidates.length));
  tries.set(p, i);
  play(p.candidates[i]);
}

function info(p) {
  const active = current === p;
  let st = 'CLIC : ÉCOUTER';
  if (active && player.status === 'tuning') st = 'SYNTONISATION...';
  if (active && player.status === 'play') st = '▶ EN ÉCOUTE · CLIC : STOP';
  if (active && player.status === 'error') st = 'SIGNAL PERDU';
  const s = active ? player.station : null;
  return `<div class="h" style="margin-top:3px">${p.name}</div>
    <div class="row"><span>FRÉQ</span><b>${p.freq} MHZ</b></div>
    ${s ? `<div class="row"><span>${esc(s.country || '--')}</span><b>${esc(s.codec || '')} ${s.bitrate ? s.bitrate + 'K' : ''}</b></div>
    <div class="hint wrap" style="max-height:24px;overflow:hidden">${esc(s.name)}</div>` : ''}
    <div class="hint" style="margin-top:2px">${st}</div>`;
}

function draw(canvas) {
  const g = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const col = getComputedStyle(document.documentElement).getPropertyValue('--pb-rgb').trim();
  const buf = new Uint8Array(512);
  let t = 0;
  const frame = () => {
    t += 0.016;
    g.clearRect(0, 0, W, H);
    // Graticule: axes with tick marks like a lab scope.
    g.strokeStyle = `rgba(${col},.25)`;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, H / 2); g.lineTo(W, H / 2);
    for (let x = 0; x <= W; x += W / 10) { g.moveTo(x, H / 2 - 4); g.lineTo(x, H / 2 + 4); }
    for (let y = 0; y <= H; y += H / 6) { g.moveTo(0, y); g.lineTo(6, y); g.moveTo(W - 6, y); g.lineTo(W, y); }
    g.stroke();

    g.strokeStyle = `rgb(${col})`;
    g.shadowColor = `rgb(${col})`;
    g.shadowBlur = 6;
    g.lineWidth = 2.5;
    g.beginPath();
    const playing = player.status === 'play';
    const tuning = player.status === 'tuning';
    if (playing && player.analyser) {
      player.analyser.getByteTimeDomainData(buf);
      for (let i = 0; i < buf.length; i++) {
        const x = (i / (buf.length - 1)) * W;
        const y = H / 2 + ((buf[i] - 128) / 128) * H * 0.45;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
    } else {
      const amp = playing ? (0.25 + 0.12 * Math.sin(t * 2.3) + 0.08 * Math.sin(t * 7.1)) * H : tuning ? 0.12 * H : 0.01 * H;
      for (let x = 0; x <= W; x += 2) {
        const p = (x / W) * Math.PI * 2;
        let y = Math.sin(p * 3 + t * 6) * amp + Math.sin(p * 7 - t * 9) * amp * 0.25;
        if (tuning) y += (Math.random() - 0.5) * H * 0.35;
        y = H / 2 + y;
        x ? g.lineTo(x, y) : g.moveTo(x, y);
      }
    }
    g.stroke();
    g.shadowBlur = 0;
    raf = requestAnimationFrame(frame);
  };
  frame();
}

export default {
  id: 'radio',
  label: 'STATIONS',
  mount(el) {
    list = new List(el, {
      width: 108,
      index: Math.max(0, [...PRESETS, CUSTOM].indexOf(current)),
      label: (p) => `${current === p && player.status !== 'stop' ? '▶' : ' '} ${p.name}`,
      detail: (p, i, d) => {
        if (!d.querySelector('canvas')) {
          d.innerHTML = '<canvas class="scope" width="224" height="150"></canvas><div class="info"></div>';
          draw(d.querySelector('canvas'));
        }
        d.querySelector('.info').innerHTML = info(p);
      },
      onSelect: tune,
    });
    list.setItems([...PRESETS, CUSTOM]);
    offs = [on('radio', () => list.render())];
  },
  unmount() {
    offs.forEach((f) => f());
    cancelAnimationFrame(raf);
  },
  onScroll: (d) => list.move(d),
  onClick: () => list.select(),
};
