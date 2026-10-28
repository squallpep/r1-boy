// Terminal-style boot sequence, then the logo screen. Resolves on the first press.
import { sfx } from './sfx.js';
import { mascot } from '../ui/icons.js';
import { BUILD } from './update.js';

const LINES = [
  'ATOMIK INDUSTRIES (C) 2077',
  'R1-OS BIOS V4.20 ............ OK',
  '',
  'TEST MÉMOIRE  64K RAM ....... OK',
  'TEST MÉMOIRE  38911 OCTETS LIBRES',
  'CHARGEMENT NOYAU ............ OK',
  'MONTAGE /DEV/HOLOTAPE ....... OK',
  'CAPTEUR ACCÉLÉRO ........... [OK]',
  'MODULE GPS ................. [OK]',
  'RÉCEPTEUR RADIO ............ [OK]',
  'LIAISON TV ................. [OK]',
  'CALIBRAGE PHOSPHORE ........ [OK]',
  '',
  '>> DÉMARRAGE R1-BOY 3000 MK IV',
];

export function boot(app) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'boot';
    app.append(el);
    let stage = 0; // 0 = typing, 1 = logo, 2 = done
    let timer;

    const showLogo = () => {
      if (stage !== 0) return;
      stage = 1;
      clearTimeout(timer);
      el.innerHTML = `<div class="boot-logo">${mascot('mascot bob')}
        <div class="title">R1-BOY 3000</div>
        <div class="hint">ASSISTANT PERSONNEL ATOMIK · V${BUILD}</div>
        <div class="press">▶ APPUYEZ POUR DÉMARRER</div>
        <div class="hint" style="margin-top:6px">MOLETTE : NAVIGUER · CLIC : VALIDER<br>APPUI LONG : ONGLETS / RETOUR</div>
      </div>`;
    };

    const finish = () => {
      if (stage === 0) return showLogo();
      if (stage === 2) return;
      stage = 2;
      sfx.unlock();
      sfx.boot();
      cleanup();
      el.classList.add('glitch');
      setTimeout(() => { el.remove(); resolve(); }, 250);
    };

    const cleanup = () => {
      window.removeEventListener('sideClick', finish);
      window.removeEventListener('keydown', onKey);
      el.removeEventListener('pointerdown', finish);
    };
    const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') finish(); };
    window.addEventListener('sideClick', finish);
    window.addEventListener('keydown', onKey);
    el.addEventListener('pointerdown', finish);

    // Type the lines character by character.
    let li = 0;
    let ci = 0;
    let out = '';
    const type = () => {
      if (stage !== 0) return;
      if (li >= LINES.length) { timer = setTimeout(showLogo, 500); return; }
      const line = LINES[li];
      ci = Math.min(line.length, ci + 3);
      el.innerHTML = out + line.slice(0, ci) + '<span class="cursor"></span>';
      if (ci >= line.length) {
        out += line + '<br>';
        li++;
        ci = 0;
        timer = setTimeout(type, 70);
      } else {
        timer = setTimeout(type, 12);
      }
    };
    type();
  });
}
