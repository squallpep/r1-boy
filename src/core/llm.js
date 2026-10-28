// Bridge to the rabbit LLM: PluginMessageHandler.postMessage -> window.onPluginMessage.
export const llmAvailable = () => typeof window.PluginMessageHandler !== 'undefined';

let pending = null;

window.onPluginMessage = (data) => {
  const p = pending;
  if (!p) return;
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

/**
 * Ask the rabbit LLM. Resolves { text, obj } (obj = parsed JSON if any).
 * speak: the R1 reads the answer out loud. One request at a time.
 */
export function askLLM(message, { speak = false, timeout = 45000 } = {}) {
  if (!llmAvailable()) return Promise.reject(new Error('unavailable'));
  if (pending) {
    clearTimeout(pending.timer);
    pending.reject(new Error('superseded'));
  }
  return new Promise((resolve, reject) => {
    pending = { resolve, reject, timer: setTimeout(() => { pending = null; reject(new Error('timeout')); }, timeout) };
    window.PluginMessageHandler.postMessage(JSON.stringify({
      message,
      useLLM: true,
      wantsR1Response: speak,
      wantsJournalEntry: false,
    }));
  });
}
