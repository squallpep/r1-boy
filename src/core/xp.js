// Experience, levels, quests rewards and perks (achievements).
import { state, save, emit, today } from './store.js';
import { sfx } from './sfx.js';
import { toast } from '../ui/ui.js';

export const xpNeeded = (lvl) => 100 + (lvl - 1) * 50;

export function levelInfo(xp = state.xp) {
  let lvl = 1;
  let rest = xp;
  while (rest >= xpNeeded(lvl)) {
    rest -= xpNeeded(lvl);
    lvl++;
  }
  return { lvl, cur: rest, need: xpNeeded(lvl) };
}

export function addXp(n, title, sub) {
  const before = levelInfo().lvl;
  state.xp += n;
  save();
  emit('xp');
  if (title) toast(title, sub ?? `+${n} XP`);
  const after = levelInfo().lvl;
  if (after > before) {
    sfx.levelUp();
    toast('NIVEAU SUPÉRIEUR !', `VOUS ÊTES NIVEAU ${after}`, { big: true });
  }
  checkPerks();
}

export const questReward = (q) => (q.type === 'main' ? 50 : 20);

export function completeQuest(q) {
  q.done = true;
  q.doneDay = today();
  state.stats.questsDone++;
  sfx.quest();
  emit('quests');
  addXp(questReward(q), 'QUÊTE TERMINÉE', `${q.title}\n+${questReward(q)} XP`);
}

export const PERKS = [
  { id: 'step1', name: 'PREMIERS PAS', desc: 'Marcher 100 pas avec le R1-BOY.', ok: (s) => s.stats.stepsTotal >= 100 },
  { id: 'hiker', name: 'RANDONNEUR', desc: 'Atteindre 10 000 pas en une journée.', ok: (s) => s.stats.stepsToday >= 10000 },
  { id: 'marathon', name: 'MARATHONIEN', desc: 'Cumuler 100 000 pas.', ok: (s) => s.stats.stepsTotal >= 100000 },
  { id: 'quest1', name: 'AVENTURIER', desc: 'Terminer une première quête.', ok: (s) => s.stats.questsDone >= 1 },
  { id: 'quest25', name: 'HÉROS DU QUOTIDIEN', desc: 'Terminer 25 quêtes.', ok: (s) => s.stats.questsDone >= 25 },
  { id: 'place5', name: 'EXPLORATEUR', desc: 'Découvrir 5 lieux sur la carte.', ok: (s) => s.places.length >= 5 },
  { id: 'place25', name: 'CARTOGRAPHE', desc: 'Découvrir 25 lieux sur la carte.', ok: (s) => s.places.length >= 25 },
  { id: 'radio60', name: 'MÉLOMANE', desc: 'Écouter la radio pendant 60 minutes.', ok: (s) => s.stats.radioMinutes >= 60 },
  { id: 'tv', name: 'TÉLÉSPECTATEUR', desc: 'Regarder une chaîne de télévision.', ok: (s) => s.stats.tvWatched },
  { id: 'meteo', name: 'MÉTÉOROLOGUE', desc: 'Consulter le rapport atmosphérique.', ok: (s) => s.stats.weatherChecked },
  { id: 'night', name: 'NOCTAMBULE', desc: 'Allumer le R1-BOY entre minuit et 5 h.', ok: (s) => s.stats.nightOwl },
  { id: 'lvl5', name: 'VÉTÉRAN', desc: 'Atteindre le niveau 5.', ok: () => levelInfo().lvl >= 5 },
  { id: 'lvl20', name: 'LÉGENDE', desc: 'Atteindre le niveau 20.', ok: () => levelInfo().lvl >= 20 },
];

export function checkPerks() {
  for (const p of PERKS) {
    if (state.perks[p.id] || !p.ok(state)) continue;
    state.perks[p.id] = today();
    save();
    emit('perks');
    addXp(25, 'PERK DÉBLOQUÉ', `${p.name}\n+25 XP`);
  }
}
