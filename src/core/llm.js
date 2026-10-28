// Bridge to the rabbit LLM: PluginMessageHandler.postMessage -> window.onPluginMessage.
import { emit } from './store.js';

export const llmAvailable = () => typeof window.PluginMessageHandler !== 'undefined';

let pending = null;
let lateUntil = 0; // a reply to a timed-out/superseded request may still arrive: drop it

window.onPluginMessage = (data) => {
  const p = pending;
  if (!p && Date.now() < lateUntil) {
    lateUntil = 0;
    return;
  }
  // Messages we did not ask for (e.g. a voice exchange with rabbit) are shown by the IA screen.
  if (!p) return emit('llm', parse(data));
  pending = null;
  clearTimeout(p.timer);
  p.resolve(parse(data));
};

function parse(data) {
  let text = typeof data?.message === 'string' ? data.message : '';
  let obj = null;
  if (data?.data) {
    try {
      obj = JSON.parse(data.data);
    } catch {
      text = text || String(data.data);
    }
  }
  if (!obj) {
    // The model sometimes wraps JSON in prose; pull out the first object.
    const m = /\{[\s\S]*\}/.exec(text);
    if (m) try { obj = JSON.parse(m[0]); } catch {}
  }
  return { text: text.trim(), obj };
}

// Replies carry no request id, so requests are queued: one in flight, replies matched in order.
let queue = Promise.resolve();

/**
 * Ask the rabbit LLM. Resolves { text, obj } (obj = parsed JSON if any).
 * speak: the R1 reads the answer out loud.
 */
export function askLLM(message, opts) {
  if (!llmAvailable()) return Promise.reject(new Error('unavailable'));
  const run = () => send(message, opts);
  const p = queue.then(run, run);
  queue = p.catch(() => {});
  return p;
}

function send(message, { speak = false, timeout = 45000 } = {}) {
  return new Promise((resolve, reject) => {
    pending = {
      resolve,
      reject,
      timer: setTimeout(() => {
        pending = null;
        lateUntil = Date.now() + 60000;
        reject(new Error('timeout'));
      }, timeout),
    };
    window.PluginMessageHandler.postMessage(JSON.stringify({
      message,
      useLLM: true,
      wantsR1Response: speak,
      wantsJournalEntry: false,
    }));
  });
}
