// DATA > IA: terminal to the rabbit LLM with a retro persona; can generate quests and radio bulletins.
import { state, save, emit } from '../../core/store.js';
import { levelInfo } from '../../core/xp.js';
import { askLLM, llmAvailable } from '../../core/llm.js';
import { sfx } from '../../core/sfx.js';
import { List } from '../../ui/list.js';
import { esc, promptText, toast } from '../../ui/ui.js';

const PERSONA = "Tu es R1-BOY 3000, l'assistant de poignet rétro-futuriste d'ATOMIK INDUSTRIES, "
  + "au ton enjoué des années 50 avec un humour post-apocalyptique bienveillant. "
  + 'Réponds en français, en 60 mots maximum, sans markdown ni emoji. ';

function context() {
  const d = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return `Contexte : nous sommes ${d}, l'utilisateur est niveau ${levelInfo().lvl}, `
    + `a fait ${state.stats.stepsToday} pas aujourd'hui et accompli ${state.stats.questsDone} quêtes. `;
}

const ACTIONS = [
  { name: 'QUESTION LIBRE', desc: 'Posez une question au terminal.', ask: true },
  { name: 'BULLETIN RADIO', desc: "Bulletin d'ambiance du jour, façon DJ de station rétro.", prompt: () => `${PERSONA}${context()}Présente un court bulletin radio pour aujourd'hui, comme un DJ de station rétro.` },
  { name: 'QUÊTE IA', desc: 'Génère une quête du jour et l\'ajoute au journal.', quest: true },
  { name: 'MOTIVATION', desc: 'Un mot d\'encouragement basé sur vos stats.', prompt: () => `${PERSONA}${context()}Donne-lui un message de motivation personnalisé.` },
  { name: 'CONSEIL DE SURVIE', desc: 'Une astuce utile du quotidien, version abri antiatomique.', prompt: () => `${PERSONA}Donne une astuce pratique et vraie pour la vie quotidienne, présentée comme un conseil de survie.` },
  { name: 'FAIT ÉTONNANT', desc: 'Une anecdote scientifique ou historique.', prompt: () => `${PERSONA}Raconte un fait réel étonnant, scientifique ou historique.` },
  { name: 'BLAGUE', desc: 'Humour approuvé par le département du moral.', prompt: () => `${PERSONA}Raconte une blague courte et tout public.` },
  { name: 'VOIX', desc: 'Le R1 lit les réponses à voix haute.', toggle: true },
  { name: 'DERNIÈRE RÉPONSE', desc: 'Relire la dernière transmission.', last: true },
];

let root, list, reader = null, typeT;

function openReader(title, body, { typing = false } = {}) {
  clearTimeout(typeT);
  root.innerHTML = `<div class="ai-reader"><div class="dim">&gt; ${esc(title)}</div><div class="ai-text"></div></div>`;
  reader = root.firstChild;
  const out = reader.querySelector('.ai-text');
  if (!typing) {
    out.innerHTML = esc(body).replace(/\n/g, '<br>');
    return;
  }
  // Teletype effect.
  let i = 0;
  const step = () => {
    i = Math.min(body.length, i + 2);
    out.innerHTML = esc(body.slice(0, i)).replace(/\n/g, '<br>') + (i < body.length ? '<span class="cur">█</span>' : '');
    reader.scrollTop = reader.scrollHeight;
    if (i < body.length) typeT = setTimeout(step, 18);
  };
  step();
}

function waiting(title) {
  root.innerHTML = `<div class="ai-reader"><div class="dim">&gt; ${esc(title)}</div>
    <div class="ai-text">TRANSMISSION VERS LE RÉSEAU RABBIT<span class="cur">...</span></div></div>`;
  reader = root.firstChild;
}

function closeReader() {
  clearTimeout(typeT);
  reader = null;
  root.innerHTML = '';
  mountList();
}

async function run(title, message, { quest = false } = {}) {
  if (!llmAvailable()) {
    sfx.error();
    return openReader(title, "LIAISON RABBIT INDISPONIBLE.\n\nCette fonction utilise l'IA du Rabbit R1 : ouvrez le R1-BOY sur l'appareil.");
  }
  waiting(title);
  const staticH = sfx.static(0.05);
  try {
    const { text, obj } = await askLLM(message, { speak: !quest && state.settings.aiVoice });
    staticH.stop();
    if (!root?.isConnected) return;
    let body = text || '(RÉPONSE VIDE)';
    if (quest) {
      const t = (obj?.title || text || '').replace(/["{}]/g, '').trim().toUpperCase().slice(0, 50);
      if (!t) throw new Error('empty');
      state.quests.push({ id: 'm-' + Date.now(), title: t, type: 'main', done: false });
      emit('quests');
      toast('NOUVELLE QUÊTE', t);
      body = `NOUVELLE QUÊTE AJOUTÉE AU JOURNAL :\n\n${t}\n\nRÉCOMPENSE : 50 XP`;
    }
    state.aiLast = { title, body };
    save();
    sfx.select();
    openReader(title, body, { typing: true });
  } catch (e) {
    staticH.stop();
    if (e.message === 'superseded' || !root?.isConnected) return;
    sfx.error();
    openReader(title, e.message === 'timeout' ? 'AUCUNE RÉPONSE DU RÉSEAU. RÉESSAYEZ.' : 'ERREUR DE TRANSMISSION.');
  }
}

async function select(a) {
  if (a.toggle) {
    state.settings.aiVoice = !state.settings.aiVoice;
    save();
    sfx.select();
    return list.render();
  }
  if (a.last) {
    if (!state.aiLast) return toast('TERMINAL', 'AUCUNE TRANSMISSION');
    sfx.select();
    return openReader(state.aiLast.title, state.aiLast.body);
  }
  if (a.ask) {
    const q = await promptText('QUESTION AU TERMINAL', '', 'ex. idée de repas rapide ?');
    if (!q) return;
    return run(q.toUpperCase(), `${PERSONA}${context()}Question de l'utilisateur : ${q}`);
  }
  sfx.select();
  if (a.quest) {
    return run(a.name, `${PERSONA}Invente une petite quête réaliste et utile à faire aujourd'hui (ranger, marcher, appeler un proche, apprendre quelque chose...). `
      + 'Réponds UNIQUEMENT avec du JSON valide au format {"title":"..."} où title fait 40 caractères maximum.', { quest: true });
  }
  run(a.name, a.prompt());
}

function mountList() {
  list = new List(root, {
    width: 122,
    index: list?.idx,
    label: (a) => (a.toggle ? `VOIX : ${state.settings.aiVoice ? 'OUI' : 'NON'}` : a.name),
    detail: (a) => `<div class="h">${a.toggle ? 'VOIX R1' : a.name}</div>
      <p class="wrap">${a.desc}</p>
      <div class="row"><span>LIAISON</span><b>${llmAvailable() ? 'RABBIT OK' : 'HORS LIGNE'}</b></div>
      <div class="hint">CLIC : ${a.toggle ? 'BASCULER' : 'TRANSMETTRE'}</div>`,
    onSelect: select,
  });
  list.setItems(ACTIONS);
}

export default {
  id: 'ia',
  label: 'IA',
  mount(el) {
    root = el;
    reader = null;
    list = null;
    mountList();
  },
  unmount() {
    clearTimeout(typeT);
    root = null;
  },
  onScroll(d) {
    if (reader) reader.scrollTop += d * 28;
    else list.move(d);
  },
  onClick() {
    if (reader) return closeReader();
    list.select();
  },
  onBack() {
    if (!reader) return false;
    closeReader();
    sfx.back();
    return true;
  },
};
