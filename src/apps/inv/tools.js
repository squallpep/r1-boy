// INV tab: tools listed like inventory items; clicking "equips" (opens) the tool.
import { sfx } from '../../core/sfx.js';
import { List } from '../../ui/list.js';
import { icons } from '../../ui/icons.js';
import { lampView, timerView, compassView, levelView, geigerView, timer } from './views.js';

const TOOLS = {
  outils: [
    { name: 'LAMPE TORCHE', icon: 'lamp', view: lampView, wg: 1, val: 20, desc: 'Éclairage plein écran : blanc, phosphore, rouge ou signal SOS.' },
    { name: 'MINUTEUR', icon: 'timer', view: timerView, wg: 1, val: 35, desc: 'Compte à rebours avec alarme. Continue en arrière-plan.' },
  ],
  capteurs: [
    { name: 'BOUSSOLE', icon: 'compass', view: compassView, wg: 1, val: 45, desc: 'Cap magnétique, ou cap GPS en mouvement.' },
    { name: 'NIVEAU À BULLE', icon: 'level', view: levelView, wg: 2, val: 25, desc: "Posez le R1 à plat. L'accéléromètre fait le reste." },
    { name: 'COMPTEUR GEIGER', icon: 'geiger', view: geigerView, wg: 3, val: 120, desc: 'Détecteur de radiations ambiantes. Usage récréatif uniquement.' },
  ],
};

function makeScreen(id, label) {
  let list, root, open = null;

  const close = () => {
    open.unmount();
    open = null;
    root.innerHTML = '';
    mountList();
    sfx.back();
  };

  const mountList = () => {
    list = new List(root, {
      width: 112,
      index: list?.idx,
      label: (t) => (t.view === timerView && (timer.running || timer.alarm) ? '▶ ' : '') + t.name,
      detail: (t) => `<div class="center">${icons[t.icon].replace('ico', 'ico lg')}</div>
        <div class="h center">${t.name}</div>
        <div class="row"><span>POIDS</span><b>${t.wg}</b></div>
        <div class="row"><span>VAL</span><b>${t.val}</b></div>
        <p class="wrap" style="margin:4px 0">${t.desc}</p>
        <div class="hint">CLIC : ÉQUIPER</div>`,
      onSelect: (t) => {
        sfx.select();
        open = t.view;
        root.innerHTML = '';
        open.mount(root);
      },
    });
    list.setItems(TOOLS[id]);
  };

  return {
    id,
    label,
    mount(el) {
      root = el;
      list = null;
      mountList();
    },
    unmount() {
      open?.unmount();
      open = null;
    },
    onScroll: (d) => (open ? open.onScroll?.(d) : list.move(d)),
    onClick: () => (open ? open.onClick?.() : list.select()),
    onBack() {
      if (!open) return false;
      close();
      return true;
    },
  };
}

export const toolsScreen = makeScreen('outils', 'OUTILS');
export const sensorsScreen = makeScreen('capteurs', 'CAPTEURS');
