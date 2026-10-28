// Normalizes R1 hardware (wheel, side button, long press) plus keyboard/mouse for desktop dev.
export const isR1 = typeof window.PluginMessageHandler !== 'undefined' || !!window.creationStorage;

export function initInput({ scroll, click, back }) {
  let lastLong = 0;
  window.addEventListener('scrollUp', () => scroll(-1));
  window.addEventListener('scrollDown', () => scroll(1));
  window.addEventListener('sideClick', () => {
    // A long press can be followed by a stray click on some firmwares.
    if (Date.now() - lastLong < 400) return;
    click();
  });
  window.addEventListener('longPressEnd', () => {
    lastLong = Date.now();
    back();
  });

  window.addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea')) return;
    switch (e.key) {
      case 'ArrowUp': case 'ArrowLeft': scroll(-1); break;
      case 'ArrowDown': case 'ArrowRight': scroll(1); break;
      case 'Enter': case ' ': click(); break;
      case 'Escape': case 'Backspace': back(); break;
      default: return;
    }
    e.preventDefault();
  });

  if (!isR1) {
    let last = 0;
    window.addEventListener('wheel', (e) => {
      e.preventDefault();
      const now = Date.now();
      if (now - last < 70 || !e.deltaY) return;
      last = now;
      scroll(Math.sign(e.deltaY));
    }, { passive: false });
  }
}
