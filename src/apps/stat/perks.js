import { state, on } from '../../core/store.js';
import { PERKS } from '../../core/xp.js';
import { List } from '../../ui/list.js';
import { icons } from '../../ui/icons.js';

let list, off;

export default {
  id: 'perks',
  label: 'PERKS',
  mount(el) {
    list = new List(el, {
      width: 124,
      label: (p) => `${state.perks[p.id] ? '■' : '□'} ${p.name}`,
      cls: (p) => (state.perks[p.id] ? '' : 'done'),
      detail: (p) => {
        const got = state.perks[p.id];
        return `<div class="center">${got ? icons.perk.replace('ico', 'ico lg') : icons.lock.replace('ico', 'ico lg')}</div>
          <div class="h center">${p.name}</div>
          <p class="wrap">${p.desc}</p>
          <div class="row"><span>ÉTAT</span><b>${got ? 'ACQUIS' : 'VERROUILLÉ'}</b></div>
          ${got ? `<div class="hint">LE ${got.split('-').reverse().join('/')}</div>` : ''}`;
      },
    });
    list.setItems(PERKS);
    off = on('perks', () => list.render());
  },
  unmount() { off(); },
  onScroll: (d) => list.move(d),
};
