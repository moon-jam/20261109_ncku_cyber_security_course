(() => {
  'use strict';
  // Marp 播放器使用數字頁碼；作者仍使用明確且穩定的命名 anchor。
  const slides = () => [...document.querySelectorAll('svg.bespoke-marp-slide')];
  function pageFor(id) {
    const target = document.getElementById(id);
    const slide = target?.closest('svg.bespoke-marp-slide');
    const index = slides().indexOf(slide);
    return index < 0 ? null : String(index + 1);
  }
  function resolveNamedHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id || /^\d+$/.test(id)) return;
    const page = pageFor(id);
    if (page) location.replace('#' + page);
  }
  document.addEventListener('click', (event) => {
    const link = event.target.closest?.('a[href^="#"]');
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const page = pageFor(decodeURIComponent(link.getAttribute('href').slice(1)));
    if (!page) return;
    event.preventDefault();
    event.stopPropagation();
    location.hash = page;
  }, true);
  // Vim-style navigation must never consume text editing or IME input.
  document.addEventListener('keydown', (event) => {
    const delta = { h: -1, k: -1, j: 1, l: 1 }[event.key];
    if (typeof delta !== 'number' || event.defaultPrevented || event.isComposing ||
        event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    const editing = event.composedPath().some(target => target instanceof Element &&
      (target.isContentEditable || target.matches('input, textarea, select, [role="textbox"], [role="combobox"]')));
    if (editing || document.querySelector('dialog[open]')) return;
    const pages = slides();
    const current = pages.findIndex(slide => slide.classList.contains('bespoke-marp-active'));
    if (current < 0) return; // Static exports and standalone pages have no deck.
    event.preventDefault();
    event.stopImmediatePropagation();
    const next = Math.max(0, Math.min(pages.length - 1, current + delta));
    if (next !== current) location.hash = String(next + 1);
  }, true);
  window.addEventListener('hashchange', resolveNamedHash);
  resolveNamedHash();
})();
