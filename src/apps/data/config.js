// DATA > CONFIG: phosphor color, sounds, pedometer, TV filter, IPTV playlist, custom radio, reset.
import { state, save, reset, emit } from '../../core/store.js';
import { setPedometer } from '../../core/sensors.js';
import { sfx } from '../../core/sfx.js';
import { List } from '../../ui/list.js';
import { esc, promptText, confirmBox, toast } from '../../ui/ui.js';
import { icons } from '../../ui/icons.js';
import { BUILD } from '../../core/update.js';

const THEMES = { green: 'VERT', amber: 'AMBRE', blue: 'BLEU', white: 'BLANC' };

export function applyTheme() {
  document.documentElement.dataset.theme = state.settings.theme;
}

const s = () => state.settings;
const short = (url) => (url ? url.replace(/^https?:\/\//, '').slice(0, 40) : 'AUCUNE');

const ITEMS = [
  {
    name: () => `COULEUR : ${THEMES[s().theme]}`,
    desc: 'Couleur du phosphore de l\'écran.',
    act() {
      const keys = Object.keys(THEMES);
      s().theme = keys[(keys.indexOf(s().theme) + 1) % keys.length];
      applyTheme();
    },
  },
  {
    name: () => `SONS : ${s().sound ? 'ACTIVÉS' : 'COUPÉS'}`,
    desc: 'Clics, bips et effets sonores de l\'interface.',
    act() { s().sound = !s().sound; },
  },
  {
    name: () => `PODOMÈTRE : ${s().pedometer ? 'ACTIF' : 'INACTIF'}`,
    desc: 'Compte vos pas avec l\'accéléromètre quand l\'application est ouverte. Consomme un peu de batterie.',
    act() { s().pedometer = !s().pedometer; setPedometer(s().pedometer); },
  },
  {
    name: () => 'PLAYLIST IPTV',
    desc: () => `Adresse d'une playlist M3U. Actuelle : ${esc(short(s().iptvUrl))}`,
    async act() {
      const v = await promptText('URL PLAYLIST M3U', s().iptvUrl, 'https://.../playlist.m3u');
      if (v) { s().iptvUrl = v; emit('iptv'); }
    },
  },
  {
    name: () => 'RADIO PERSO',
    desc: () => `Flux audio personnel (MP3/AAC en https). Actuel : ${esc(short(s().customRadio))}`,
    async act() {
      const v = await promptText('URL DU FLUX RADIO', s().customRadio, 'https://.../stream.mp3');
      if (v !== null) s().customRadio = v;
    },
  },
  {
    name: () => 'EFFACER LES DONNÉES',
    desc: 'Remet à zéro XP, quêtes, perks, pas et réglages.',
    async act() {
      if (!(await confirmBox('EFFACER ?', 'Toutes les données seront perdues.'))) return;
      await reset();
      location.reload();
    },
  },
  {
    name: () => 'À PROPOS',
    desc: () => `R1-BOY 3000 MK IV · VERSION ${BUILD}<br>Multitool rétro pour Rabbit R1.<br>Météo : Open-Meteo · Carte : © OpenStreetMap · Radio : radio-browser.info`,
    act() { toast('R1-BOY 3000', 'ATOMIK INDUSTRIES\nPROPRIÉTÉ DU PORTEUR'); },
  },
];

let list;

export default {
  id: 'config',
  label: 'CONFIG',
  mount(el) {
    list = new List(el, {
      width: 132,
      label: (it) => it.name(),
      detail: (it) => `${icons.gear}<div class="h" style="margin-top:3px">${it.name()}</div>
        <p class="wrap">${typeof it.desc === 'function' ? it.desc() : it.desc}</p>
        <div class="hint">CLIC : MODIFIER</div>`,
      onSelect: async (it) => {
        sfx.select();
        await it.act();
        save();
        list.render();
      },
    });
    list.setItems(ITEMS);
  },
  onScroll: (d) => list.move(d),
  onClick: () => list.select(),
};
