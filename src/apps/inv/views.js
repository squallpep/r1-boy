// Full-screen tool views opened from the INV lists. Each: { mount(el), unmount(), onScroll(d), onClick() }.
import { state, save, emit, on } from '../../core/store.js';
import { sfx } from '../../core/sfx.js';
import { onAccel, onHeading, headingStats, bearing, calibrate } from '../../core/sensors.js';
import { gpsUsable, distance } from '../../core/geo.js';
import { toast, pad, bar } from '../../ui/ui.js';

// ---------------- Timer (keeps running when the view is closed) ----------------
export const timer = { total: 300, left: 300, running: false, end: 0, alarm: false };
let tickInt, alarmInt, alarmStop;

function timerUpdate() {
  timer.left = Math.max(0, Math.ceil((timer.end - Date.now()) / 1000));
  emit('timer');
  if (timer.left === 0) {
    clearInterval(tickInt);
    timer.running = false;
    ring();
  }
}

function ring() {
  timer.alarm = true;
  toast('MINUTEUR', 'TEMPS ÉCOULÉ !', { big: true, ms: 2500 });
  const beep3 = () => [0, 0.15, 0.3].forEach((w) => setTimeout(() => sfx.beep(1600, 0.1), w * 1000));
  beep3();
  alarmInt = setInterval(beep3, 1000);
  alarmStop = setTimeout(dismiss, 30000);
  emit('timer');
}

function dismiss() {
  clearInterval(alarmInt);
  clearTimeout(alarmStop);
  timer.alarm = false;
  timer.left = timer.total;
  emit('timer');
}

const fmt = (s) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;

export const timerView = {
  mount(el) {
    el.innerHTML = `<div class="tool-view"><div class="h">MINUTEUR</div><div class="digits"></div><div style="width:180px" class="pb"></div><div class="hint st"></div></div>`;
    const paint = () => {
      const d = el.querySelector('.digits');
      d.textContent = fmt(timer.left);
      d.classList.toggle('alarm', timer.alarm);
      el.querySelector('.pb').innerHTML = bar(timer.total ? 1 - timer.left / timer.total : 0);
      el.querySelector('.st').textContent = timer.alarm ? 'CLIC : ARRÊTER L\'ALARME'
        : timer.running ? 'EN COURS · CLIC : PAUSE'
          : 'MOLETTE : RÉGLER · CLIC : DÉMARRER';
    };
    this.off = on('timer', paint);
    paint();
  },
  unmount() { this.off(); },
  onScroll(d) {
    if (timer.running || timer.alarm) return;
    const step = timer.left < 60 ? 10 : timer.left < 600 ? 60 : 300;
    const next = d > 0 ? timer.left + step : timer.left - (timer.left <= 60 ? 10 : timer.left <= 600 ? 60 : 300);
    timer.left = timer.total = Math.max(10, Math.min(5940, next));
    sfx.tick();
    emit('timer');
  },
  onClick() {
    if (timer.alarm) return dismiss();
    sfx.select();
    if (timer.running) {
      clearInterval(tickInt);
      timer.left = Math.max(1, Math.ceil((timer.end - Date.now()) / 1000));
      timer.running = false;
    } else {
      if (timer.left === 0) timer.left = timer.total;
      timer.end = Date.now() + timer.left * 1000;
      timer.running = true;
      tickInt = setInterval(timerUpdate, 250);
    }
    emit('timer');
  },
};

// ---------------- Flashlight ----------------
const LAMP_MODES = [
  { name: 'BLANC', color: '#ffffff' },
  { name: 'PHOSPHORE', color: 'var(--pb)' },
  { name: 'VISION NOCTURNE', color: '#ff2a1a' },
  { name: 'SOS', color: '#ffffff', sos: true },
];
// Morse SOS in units: on/off durations.
const SOS = [1, 1, 1, 1, 1, 3, 3, 1, 3, 1, 3, 3, 1, 1, 1, 1, 1, 7];

export const lampView = {
  mount(el) {
    this.mode = 0;
    this.lit = true;
    el.innerHTML = `<div class="tool-view"><div class="h">LAMPE TORCHE</div><div class="hint">APPUI LONG : ÉTEINDRE</div></div>`;
    this.ov = document.createElement('div');
    this.ov.className = 'lamp-overlay';
    this.ov.addEventListener('click', () => this.onClick());
    document.getElementById('app').append(this.ov);
    this.paint();
  },
  paint() {
    clearTimeout(this.sosT);
    const m = LAMP_MODES[this.mode];
    this.ov.style.background = this.lit ? m.color : '#000';
    this.ov.innerHTML = `<div style="position:absolute;bottom:4px;width:100%;text-align:center;font-size:9px;color:#000;text-shadow:none;opacity:.6">${m.name}</div>`;
    if (m.sos && this.lit) {
      let i = 0;
      const run = () => {
        this.ov.style.background = i % 2 === 0 ? m.color : '#000';
        this.sosT = setTimeout(run, SOS[i % SOS.length] * 180);
        i++;
      };
      run();
    }
  },
  unmount() {
    clearTimeout(this.sosT);
    this.ov.remove();
  },
  onScroll(d) {
    this.mode = (this.mode + d + LAMP_MODES.length) % LAMP_MODES.length;
    sfx.tick();
    this.paint();
  },
  onClick() {
    this.lit = !this.lit;
    sfx.select();
    this.paint();
  },
};

// ---------------- Compass ----------------
const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
export const dirName = (h) => DIRS[Math.round(h / 45) % 8];

function dialSvg() {
  let t = '';
  for (let a = 0; a < 360; a += 10) {
    const long = a % 30 === 0;
    t += `<line x1="50" y1="${long ? 6 : 9}" x2="50" y2="13" transform="rotate(${a} 50 50)" stroke-width="${long ? 1.4 : .8}"/>`;
  }
  const lbl = ['N', 'E', 'S', 'O'].map((n, i) =>
    `<text x="50" y="24" transform="rotate(${i * 90} 50 50)" text-anchor="middle" font-size="9" fill="currentColor" stroke="none">${n}</text>`).join('');
  return `<svg viewBox="0 0 100 100" width="150" height="150" fill="none" stroke="currentColor">
    <circle cx="50" cy="50" r="46" stroke-width="1.2"/>
    <g class="rose" style="transform-origin:50px 50px;transition:transform .25s">${t}${lbl}
      <path d="M50 30 l5 20 -5 20 -5 -20z" stroke-width="1"/><path d="M50 30 l5 20 h-10z" fill="currentColor"/></g>
    <path d="M50 1 v8" stroke-width="2"/></svg>`;
}

// Sources, best first: magnetometer (absolute orientation), gyroscope (relative), GPS course
// computed while walking. A two-click calibration (north, then east) fixes offset and direction.
export const compassView = {
  mount(el) {
    el.innerHTML = `<div class="tool-view">${dialSvg()}<div class="big hd">---°</div>
      <div class="hint msg wrap center">ATTENTE DU CAPTEUR...</div><div class="hint diag"></div></div>`;
    const rose = el.querySelector('.rose');
    const msg = (t) => { el.querySelector('.msg').textContent = t; };
    let shown = 0;
    let lastSensor = 0;
    let gpsState = '...';
    this.src = null;
    this.raw = null;
    this.calStep = 0;
    this.msg = msg;
    const set = (h, label) => {
      // Unwrap so the CSS transition takes the short way around.
      shown += ((h - (shown % 360)) + 540) % 360 - 180;
      rose.style.transform = `rotate(${-shown}deg)`;
      el.querySelector('.hd').textContent = `${dirName(h)} ${pad(Math.round(h), 3)}°`;
      msg(label);
    };

    this.off = onHeading((h, src, raw) => {
      lastSensor = Date.now();
      this.src = src;
      this.raw = raw;
      if (this.calStep) return set(h, this.calStep === 1
        ? '1/2 · VISEZ LE NORD AVEC LE HAUT DU R1, PUIS CLIC'
        : "2/2 · TOURNEZ-VOUS VERS L'EST (90° À DROITE), PUIS CLIC");
      const cal = state.settings.compassCal ? 'CALIBRÉ' : 'NON CALIBRÉ · CLIC : CALIBRER';
      set(h, `${src === 'mag' ? 'MAGNÉTOMÈTRE' : 'GYROSCOPE'} · ${cal}`);
    });

    if (gpsUsable()) {
      let prev = null;
      this.watch = navigator.geolocation.watchPosition((p) => {
        gpsState = 'OK';
        const cur = { lat: p.coords.latitude, lon: p.coords.longitude };
        let h = p.coords.heading;
        const moved = prev ? distance(prev, cur) : 0;
        if ((h == null || isNaN(h)) && moved >= 8) h = bearing(prev, cur);
        if (!prev || moved >= 8) prev = cur;
        if (h != null && !isNaN(h) && Date.now() - lastSensor > 2000) set(h, 'CAP GPS (EN MARCHE)');
      }, (e) => { gpsState = e.code === 1 ? 'REFUSÉ' : 'ERREUR'; }, { enableHighAccuracy: true });
    } else {
      gpsState = window.isSecureContext ? 'ABSENT' : 'HTTP';
    }

    // Live diagnostic: tells which sources the device really provides.
    this.diagT = setInterval(() => {
      el.querySelector('.diag').textContent =
        `ABS ${headingStats.abs} · REL ${headingStats.rel} · VIDE ${headingStats.empty} · GPS ${gpsState}`;
      if (!lastSensor && el.querySelector('.hd').textContent === '---°') {
        msg(gpsState === 'OK' ? 'PAS DE CAPTEUR D\'ORIENTATION · MARCHEZ 10 M POUR LE CAP GPS'
          : 'AUCUNE SOURCE DE CAP DISPONIBLE');
      }
    }, 500);
  },
  unmount() {
    this.off();
    clearInterval(this.diagT);
    if (this.watch != null) navigator.geolocation.clearWatch(this.watch);
    this.watch = null;
  },
  onClick() {
    if (this.raw == null) return toast('BOUSSOLE', "AUCUN CAPTEUR D'ORIENTATION");
    sfx.select();
    if (this.calStep === 0) {
      this.calStep = 1;
      this.msg('1/2 · VISEZ LE NORD AVEC LE HAUT DU R1, PUIS CLIC');
    } else if (this.calStep === 1) {
      this.rawNorth = this.raw;
      this.calStep = 2;
      this.msg("2/2 · TOURNEZ-VOUS VERS L'EST (90° À DROITE), PUIS CLIC");
    } else {
      this.calStep = 0;
      if (calibrate(this.rawNorth, this.raw)) toast('BOUSSOLE', 'CALIBRAGE TERMINÉ');
      else { sfx.error(); toast('BOUSSOLE', 'ROTATION TROP FAIBLE · RECOMMENCEZ'); }
    }
  },
};

// ---------------- Bubble level ----------------
export const levelView = {
  mount(el) {
    this.zero = { x: 0, y: 0 };
    this.last = { x: 0, y: 0 };
    el.innerHTML = `<div class="tool-view">
      <svg viewBox="0 0 100 100" width="140" height="140" fill="none" stroke="currentColor">
        <circle cx="50" cy="50" r="46"/><circle cx="50" cy="50" r="12" stroke-dasharray="2 2"/>
        <path d="M50 2v96M2 50h96" stroke-width=".5" opacity=".5"/>
        <circle class="bubble" cx="50" cy="50" r="7" fill="currentColor" fill-opacity=".35" stroke-width="1.5"/>
      </svg>
      <div class="row" style="width:150px"><span>X</span><b class="ax">0.0°</b><span>Y</span><b class="ay">0.0°</b></div>
      <div class="hint">CLIC : CALIBRER À ZÉRO</div></div>`;
    const b = el.querySelector('.bubble');
    const deg = (v) => (Math.asin(Math.max(-1, Math.min(1, v))) * 180) / Math.PI;
    let sx = 0, sy = 0;
    this.off = onAccel(({ x, y }) => {
      this.last = { x, y };
      sx = sx * 0.8 + (x - this.zero.x) * 0.2;
      sy = sy * 0.8 + (y - this.zero.y) * 0.2;
      const r = Math.min(1, Math.hypot(sx, sy) * 3);
      const a = Math.atan2(sy, sx);
      b.setAttribute('cx', 50 - Math.cos(a) * r * 38);
      b.setAttribute('cy', 50 + Math.sin(a) * r * 38);
      el.querySelector('.ax').textContent = deg(sx).toFixed(1) + '°';
      el.querySelector('.ay').textContent = deg(sy).toFixed(1) + '°';
    });
  },
  unmount() { this.off(); },
  onClick() {
    this.zero = { ...this.last };
    sfx.select();
    toast('NIVEAU', 'CALIBRÉ');
  },
};

// ---------------- Geiger counter (motion driven, for fun) ----------------
export const geigerView = {
  mount(el) {
    this.mute = false;
    el.innerHTML = `<div class="tool-view">
      <div class="h">COMPTEUR GEIGER</div>
      <svg viewBox="0 0 100 60" width="170" height="102" fill="none" stroke="currentColor">
        <path d="M10 55 A40 40 0 0 1 90 55"/>
        ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<line x1="50" y1="17" x2="50" y2="22" transform="rotate(${-90 + i * 30} 50 55)"/>`).join('')}
        <text x="14" y="50" font-size="6" fill="currentColor" stroke="none">0</text>
        <text x="80" y="50" font-size="6" fill="currentColor" stroke="none">50</text>
        <line class="needle" x1="50" y1="55" x2="50" y2="20" stroke-width="1.6" style="transform-origin:50px 55px;transition:transform .2s"/>
        <circle cx="50" cy="55" r="3" fill="currentColor"/>
      </svg>
      <div class="big rate">0.0</div><div class="hint">RAD/S · BOUGEZ LE R1 POUR MESURER</div>
      <div class="hint m">CLIC : SON COUPÉ/ACTIF</div></div>`;
    let motion = 0;
    let drift = 0.3;
    this.off = onAccel(({ x, y, z }) => {
      motion = motion * 0.9 + Math.abs(Math.hypot(x, y, z) - 1) * 0.1;
    });
    let last = performance.now();
    let shown = 0;
    const loop = (t) => {
      const dt = (t - last) / 1000;
      last = t;
      drift = Math.max(0.1, Math.min(2, drift + (Math.random() - 0.5) * dt));
      const rate = drift + motion * 120;
      if (!this.mute && Math.random() < rate * dt) sfx.geiger();
      shown = shown * 0.9 + rate * 0.1;
      el.querySelector('.rate').textContent = shown.toFixed(1);
      el.querySelector('.needle').style.transform = `rotate(${-90 + Math.min(1, shown / 50) * 180}deg)`;
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  },
  unmount() {
    this.off();
    cancelAnimationFrame(this.raf);
  },
  onClick() {
    this.mute = !this.mute;
    toast('GEIGER', this.mute ? 'SON COUPÉ' : 'SON ACTIF');
  },
};
