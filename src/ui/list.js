// Pip-Boy list: selectable rows on the left (inverse video), detail panel on the right.
import { sfx } from '../core/sfx.js';

export class List {
  /**
   * opt.label(item, i) -> html, opt.detail(item, i, el) -> html | void,
   * opt.onSelect(item, i), opt.onMove(item, i), opt.cls(item) -> class,
   * opt.width (px, left column), opt.empty (text)
   */
  constructor(root, opt) {
    this.opt = opt;
    this.items = [];
    this.idx = opt.index || 0;
    this.el = document.createElement('div');
    this.el.className = 'split';
    this.listEl = document.createElement('div');
    this.listEl.className = 'list' + (opt.detail ? '' : ' full');
    if (opt.width) this.listEl.style.width = opt.width + 'px';
    this.el.append(this.listEl);
    if (opt.detail) {
      this.detailEl = document.createElement('div');
      this.detailEl.className = 'detail';
      this.el.append(this.detailEl);
    }
    root.append(this.el);
    this.listEl.addEventListener('click', (e) => {
      const row = e.target.closest('.it');
      if (!row) return;
      const i = +row.dataset.i;
      if (i === this.idx) this.select();
      else this.setIndex(i);
    });
  }

  get current() { return this.items[this.idx]; }

  setItems(items) {
    // Keep the cursor on the same item when the list is re-sorted.
    const keep = items.indexOf(this.current);
    this.items = items;
    this.idx = keep >= 0 ? keep : Math.max(0, Math.min(this.idx, items.length - 1));
    this.render();
  }

  render() {
    const { label, cls, empty } = this.opt;
    this.listEl.innerHTML = this.items.length
      ? this.items.map((it, i) =>
        `<div class="it ${i === this.idx ? 'sel' : ''} ${cls?.(it) || ''}" data-i="${i}">${label(it, i)}</div>`).join('')
      : `<div class="empty">${empty || 'AUCUN ÉLÉMENT'}</div>`;
    this.ensureVisible();
    this.renderDetail();
  }

  renderDetail() {
    if (!this.detailEl) return;
    const it = this.current;
    const out = it ? this.opt.detail(it, this.idx, this.detailEl) : '';
    if (typeof out === 'string') this.detailEl.innerHTML = out;
  }

  setIndex(i) {
    if (i < 0 || i >= this.items.length || i === this.idx) return;
    this.listEl.children[this.idx]?.classList.remove('sel');
    this.idx = i;
    this.listEl.children[i]?.classList.add('sel');
    this.ensureVisible();
    sfx.tick();
    this.renderDetail();
    this.opt.onMove?.(this.current, i);
  }

  move(dir) {
    this.setIndex(Math.max(0, Math.min(this.items.length - 1, this.idx + dir)));
  }

  select() {
    if (this.current) this.opt.onSelect?.(this.current, this.idx);
  }

  ensureVisible() {
    const row = this.listEl.children[this.idx];
    if (!row) return;
    const l = this.listEl;
    const top = row.offsetTop;
    const bot = top + row.offsetHeight;
    if (top < l.scrollTop) l.scrollTop = top - 2;
    else if (bot > l.scrollTop + l.clientHeight) l.scrollTop = bot - l.clientHeight + 2;
  }
}
