import { state, save, on, emit } from '../../core/store.js';
import { completeQuest, questReward } from '../../core/xp.js';
import { sfx } from '../../core/sfx.js';
import { List } from '../../ui/list.js';
import { esc, promptText, confirmBox } from '../../ui/ui.js';
import { icons } from '../../ui/icons.js';

const NEW = { id: 'new', title: '+ NOUVELLE QUÊTE' };
let list, off;

function items() {
  const active = state.quests.filter((q) => !q.done);
  const done = state.quests.filter((q) => q.done);
  const order = (a, b) => (a.type === b.type ? 0 : a.type === 'main' ? -1 : 1);
  return [NEW, ...active.sort(order), ...done.sort(order)];
}

function detail(q) {
  if (q === NEW) {
    return `<div class="h">NOUVELLE QUÊTE</div>${icons.plus}
      <p class="wrap">Ajouter une quête principale à votre journal.</p>
      <div class="row"><span>RÉCOMPENSE</span><b>50 XP</b></div>
      <div class="hint">CLIC : SAISIR LE TITRE</div>`;
  }
  const extra = q.auto === 'steps' ? `<div class="row"><span>PAS</span><b>${state.stats.stepsToday}/10000</b></div>` : '';
  const action = q.done
    ? (q.type === 'main' ? 'CLIC : SUPPRIMER' : 'CLIC : ANNULER')
    : 'CLIC : TERMINER';
  return `<div class="h wrap">${esc(q.title)}</div>
    <div class="row"><span>TYPE</span><b>${q.type === 'main' ? 'PRINCIPALE' : 'QUOTIDIENNE'}</b></div>
    <div class="row"><span>RÉCOMPENSE</span><b>${questReward(q)} XP</b></div>
    ${extra}
    <div style="margin:5px 0">${q.done ? '■' : '□'} ${q.done ? 'OBJECTIF ACCOMPLI' : 'ACCOMPLIR LA TÂCHE'}</div>
    <div class="hint">${action}</div>`;
}

async function select(q) {
  if (q === NEW) {
    sfx.select();
    const title = await promptText('NOUVELLE QUÊTE', '', 'ex. RANGER LE GARAGE');
    if (!title) return;
    state.quests.push({ id: 'm-' + Date.now(), title: title.toUpperCase().slice(0, 60), type: 'main', done: false });
    save();
    emit('quests');
    return;
  }
  if (!q.done) return completeQuest(q);
  if (q.type === 'daily') {
    q.done = false;
    sfx.back();
  } else {
    if (!(await confirmBox('SUPPRIMER ?', q.title))) return;
    state.quests.splice(state.quests.indexOf(q), 1);
    sfx.back();
  }
  save();
  emit('quests');
}

export default {
  id: 'quests',
  label: 'QUÊTES',
  mount(el) {
    list = new List(el, {
      width: 120,
      label: (q) => (q === NEW ? esc(q.title) : `${q.type === 'main' ? '◆' : '◇'} ${esc(q.title)}`),
      cls: (q) => (q.done ? 'done' : ''),
      detail,
      onSelect: select,
    });
    list.setItems(items());
    off = on('quests', () => list.setItems(items()));
  },
  unmount() { off(); },
  onScroll: (d) => list.move(d),
  onClick: () => list.select(),
};
