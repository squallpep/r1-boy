// App volume (radio, TV, sound effects). A web page cannot change the R1 system volume,
// so every audio source of the app follows this level. Changed with side button held + wheel.
import { state, save, emit } from './store.js';
import { sfx } from './sfx.js';

let overlay = null;
let hideT;

export const volume = () => state.settings.volume ?? 0.8;

export function changeVolume(dir) {
  const v = Math.round(Math.max(0, Math.min(1, volume() + dir * 0.1)) * 10) / 10;
  state.settings.volume = v;
  save();
  emit('volume', v);
  sfx.beep(600 + v * 600, 0.05);
  showOverlay(v);
}

function showOverlay(v) {
  const app = document.getElementById('app');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'vol-overlay';
    app.append(overlay);
  }
  const bars = Array.from({ length: 10 }, (_, i) => `<i class="${i < v * 10 ? 'on' : ''}"></i>`).join('');
  overlay.innerHTML = `<div class="t-title">VOLUME ${Math.round(v * 100)}%</div><div class="vol-bars">${bars}</div>`;
  overlay.style.display = 'block';
  clearTimeout(hideT);
  hideT = setTimeout(() => { overlay.style.display = 'none'; }, 1200);
}
