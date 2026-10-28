// DATA > IA: terminal to the rabbit LLM with a retro persona. Voice dictation (when the web view
// supports speech recognition), answers read aloud by the R1, every answer illustrated.
import { state, save, emit, on } from '../../core/store.js';
import { levelInfo } from '../../core/xp.js';
import { askLLM, llmAvailable } from '../../core/llm.js';
import { sfx } from '../../core/sfx.js';
import { List } from '../../ui/list.js';
import { esc, promptText, toast } from '../../ui/ui.js';

const PERSONA = "Tu es R1-BOY 3000, l'assistant de poignet rétro-futuriste d'ATOMIK INDUSTRIES, "
  + "au ton enjoué des années 50 avec un humour post-apocalyptique bienveillant. "
  + 'Réponds en français, en 60 mots maximum, sans markdown ni emoji. ';

const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;

function context() {
  const d = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return `Contexte : nous sommes ${d}, l'utilisateur est niveau ${levelInfo().lvl}, `
    + `a fait ${state.stats.stepsToday} pas aujourd'hui et accompli ${state.stats.questsDone} quêtes. `;
}

// Illustration: a keyword (chosen silently by the LLM, else extracted from the text) looked up
// on French Wikipedia, whose page thumbnail is shown. Free, no key.
const STOP = new Set(('les des une dans pour avec sont cette votre vous nous notre leur leurs elle elles '
  + 'mais donc comme tout tous toute toutes plus très bien être avoir fait faire voici voilà aussi encore '
  + 'citoyen citoyens r1-boy atomik industries aujourd hui jour journée petit petite grand grande').split(' '));

function keywords(text) {
  return text.toLowerCase().split(/[^a-zà-ÿœæ-]+/).filter((w) => w.length > 4 && !STOP.has(w)).slice(0, 3).join(' ');
}

async function wikiImage(q) {
  const url = 'https://fr.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search'
    + `&gsrlimit=5&prop=pageimages&piprop=thumbnail&pithumbsize=480&gsrsearch=${encodeURIComponent(q)}`;
  const pages = Object.values((await (await fetch(url)).json()).query?.pages || {});
  return pages.sort((a, b) => a.index - b.index).find((p) => p.thumbnail)?.thumbnail.source || null;
}

async function illustrate(title, body) {
  let kw = '';
  if (llmAvailable()) {
    try {
      const { text } = await askLLM('Donne UN seul mot-clé en français (un nom commun ou un nom propre) pour illustrer ce texte '
        + `par une image. Réponds uniquement par ce mot. Texte : ${body.slice(0, 300)}`, { timeout: 15000 });
      kw = text.replace(/[^\p{L}\p{N} '-]/gu, '').trim().split(/\s+/).slice(0, 3).join(' ');
    } catch {}
  }
  for (const q of [kw, keywords(body), keywords(title)].filter(Boolean)) {
    try {
      const img = await wikiImage(q);
      if (img) return img;
    } catch {}
  }
  return null;
}

const ACTIONS = [
  { name: 'DICTER (VOIX)', desc: 'Parlez : votre question est transcrite puis envoyée.', dictate: true },
  { name: 'QUESTION ÉCRITE', desc: 'Tapez une question au clavier.', ask: true },
  { name: 'BULLETIN RADIO', desc: "Bulletin d'ambiance du jour, façon DJ de station rétro.", prompt: () => `${PERSONA}${context()}Présente un court bulletin radio pour aujourd'hui, comme un DJ de station rétro.` },
  { name: 'QUÊTE IA', desc: 'Génère une quête du jour et l\'ajoute au journal.', quest: true },
  { name: 'MOTIVATION', desc: 'Un mot d\'encouragement basé sur vos stats.', prompt: () => `${PERSONA}${context()}Donne-lui un message de motivation personnalisé.` },
  { name: 'CONSEIL DE SURVIE', desc: 'Une astuce utile du quotidien, version abri antiatomique.', prompt: () => `${PERSONA}Donne une astuce pratique et vraie pour la vie quotidienne, présentée comme un conseil de survie.` },
  { name: 'FAIT ÉTONNANT', desc: 'Une anecdote scientifique ou historique.', prompt: () => `${PERSONA}Raconte un fait réel étonnant, scientifique ou historique.` },
  { name: 'BLAGUE', desc: 'Humour approuvé par le département du moral.', prompt: () => `${PERSONA}Raconte une blague courte et tout public.` },
  { name: 'VOIX', desc: 'Le R1 lit les réponses à voix haute.', toggle: true },
  { name: 'DERNIÈRE RÉPONSE', desc: 'Relire la dernière transmission.', last: true },
];

let root, list, reader = null, typeT, rec = null, offs = [];

function openReader(title, body, { typing = false, image = null } = {}) {
  clearTimeout(typeT);
  root.innerHTML = `<div class="ai-reader"><div class="dim">&gt; ${esc(title)}</div>
    ${image ? `<div class="ai-img phos"><span class="hint">ILLUSTRATION EN COURS...</span><img alt=""></div>` : ''}
    <div class="ai-text"></div></div>`;
  reader = root.firstChild;
  if (image) {
    // image: a URL or a promise of one (illustration still being looked up).
    const img = reader.querySelector('img');
    const label = reader.querySelector('.ai-img .hint');
    Promise.resolve(image).then((url) => {
      if (!img.isConnected) return;
      if (!url) { label.textContent = 'AUCUNE ILLUSTRATION'; return; }
      img.onload = () => { label.remove(); img.style.opacity = 1; };
      img.onerror = () => { label.textContent = 'ILLUSTRATION INDISPONIBLE'; };
      img.src = url;
    });
  }
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
    if (i < body.length) typeT = setTimeout(step, 18);
  };
  step();
}

function waiting(title, text = 'TRANSMISSION VERS LE RÉSEAU RABBIT') {
  root.innerHTML = `<div class="ai-reader"><div class="dim">&gt; ${esc(title)}</div>
    <div class="ai-text">${text}<span class="cur">...</span></div></div>`;
  reader = root.firstChild;
}

function closeReader() {
  clearTimeout(typeT);
  rec?.abort();
  rec = null;
  reader = null;
  root.innerHTML = '';
  mountList();
}

function remember(title, body, image) {
  state.aiLast = { title, body, image };
  save();
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
    remember(title, body, null);
    sfx.select();
    const image = illustrate(title, quest ? body.split('\n')[2] || title : body);
    image.then((url) => { if (url && state.aiLast?.body === body) remember(title, body, url); });
    openReader(title, body, { typing: true, image });
  } catch (e) {
    staticH.stop();
    if (e.message === 'superseded' || !root?.isConnected) return;
    sfx.error();
    openReader(title, e.message === 'timeout' ? 'AUCUNE RÉPONSE DU RÉSEAU. RÉESSAYEZ.' : 'ERREUR DE TRANSMISSION.');
  }
}

async function typed() {
  const q = await promptText('QUESTION AU TERMINAL', '', 'ex. idée de repas rapide ?');
  if (q) run(q.toUpperCase(), `${PERSONA}${context()}Question de l'utilisateur : ${q}`);
}

function dictate() {
  if (!SpeechRec) {
    toast('DICTÉE INDISPONIBLE', 'LE NAVIGATEUR DU R1 NE FOURNIT PAS\nLA RECONNAISSANCE VOCALE · CLAVIER');
    return typed();
  }
  waiting('DICTÉE', 'PARLEZ MAINTENANT · CLIC : TERMINER');
  rec = new SpeechRec();
  rec.lang = 'fr-FR';
  rec.interimResults = true;
  let finalText = '';
  rec.onresult = (e) => {
    const all = Array.from(e.results).map((r) => r[0].transcript).join(' ');
    if (e.results[e.results.length - 1].isFinal) finalText = all;
    const out = reader?.querySelector('.ai-text');
    if (out) out.innerHTML = `« ${esc(all)} »<span class="cur">...</span>`;
  };
  rec.onerror = (e) => {
    rec = null;
    sfx.error();
    toast('DICTÉE', e.error === 'not-allowed' ? 'MICRO REFUSÉ' : 'ÉCHEC · CLAVIER');
    closeReader();
    typed();
  };
  rec.onend = () => {
    if (!rec) return;
    rec = null;
    if (!finalText.trim()) return closeReader();
    run(finalText.toUpperCase(), `${PERSONA}${context()}Question de l'utilisateur : ${finalText}`);
  };
  rec.start();
  sfx.beep(1200, 0.08);
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
    return openReader(state.aiLast.title, state.aiLast.body, { image: state.aiLast.image });
  }
  if (a.dictate) return dictate();
  if (a.ask) return typed();
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
    detail: (a) => `<div class="h">${a.toggle ? 'LECTURE À VOIX HAUTE' : a.name}</div>
      <p class="wrap">${a.desc}</p>
      <div class="row"><span>LIAISON</span><b>${llmAvailable() ? 'RABBIT OK' : 'HORS LIGNE'}</b></div>
      ${a.dictate ? `<div class="row"><span>MICRO</span><b>${SpeechRec ? 'DISPONIBLE' : 'NON SUPPORTÉ'}</b></div>` : ''}
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
    // Answers rabbit sends on its own (e.g. after talking to the R1) are displayed here.
    offs = [on('llm', ({ text }) => {
      if (!text || !root) return;
      remember('MESSAGE RABBIT', text, null);
      const image = illustrate('MESSAGE RABBIT', text);
      image.then((url) => { if (url && state.aiLast?.body === text) remember('MESSAGE RABBIT', text, url); });
      openReader('MESSAGE RABBIT', text, { typing: true, image });
    })];
  },
  unmount() {
    clearTimeout(typeT);
    rec?.abort();
    rec = null;
    offs.forEach((f) => f());
    root = null;
  },
  onScroll(d) {
    if (reader) reader.scrollTop += d * 28;
    else list.move(d);
  },
  onClick() {
    if (rec) return rec.stop();
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
