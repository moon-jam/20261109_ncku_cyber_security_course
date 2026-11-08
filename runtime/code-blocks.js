(() => {
  'use strict';
  // Fractional line heights can round a fitting viewport down by one pixel.
  // Determine each axis from its actual content, rather than always using auto.
  function refreshOverflow(scroller) {
    const top = scroller.scrollTop, left = scroller.scrollLeft;
    scroller.style.setProperty('overflow-x', 'hidden', 'important');
    scroller.style.setProperty('overflow-y', 'hidden', 'important');
    const horizontal = scroller.scrollWidth > scroller.clientWidth + 1;
    const vertical = scroller.scrollHeight > scroller.clientHeight + 1;
    scroller.style.setProperty('overflow-x', horizontal ? 'auto' : 'hidden', 'important');
    scroller.style.setProperty('overflow-y', vertical ? 'auto' : 'hidden', 'important');
    // A real scrollbar may consume space on systems with classic scrollbars.
    if (scroller.scrollWidth > scroller.clientWidth + 1) scroller.style.setProperty('overflow-x', 'auto', 'important');
    if (scroller.scrollHeight > scroller.clientHeight + 1) scroller.style.setProperty('overflow-y', 'auto', 'important');
    scroller.scrollTop = top;
    scroller.scrollLeft = left;
  }
  window.marpRefreshCodeOverflow = refreshOverflow;
  function install() {
    if (!document.querySelector('svg.bespoke-marp-slide')) return;
    for (let pre of document.querySelectorAll('section pre, section marp-pre')) {
      const code = pre.querySelector('code');
      if (!code || pre.dataset.marpCodeLimited) continue;
      const marker = pre.previousElementSibling;
      const configured = Number(marker?.matches('.marp-code, .marp-run') ? marker.dataset.maxLines : undefined);
      const lines = Number.isInteger(configured) && configured > 0 ? configured : 10;
      if (pre.localName === 'marp-pre' || pre.hasAttribute('is')) {
        const plain = document.createElement('pre');
        for (const {name,value} of pre.attributes) if (!['is','data-auto-scaling'].includes(name)) plain.setAttribute(name,value);
        plain.append(...pre.childNodes);
        pre.replaceWith(plain);
        pre = plain;
      }
      pre.dataset.marpCodeLimited = String(lines);
      pre.classList.add('marp-code-limited');
      pre.style.setProperty('--marp-code-lines', String(lines));
      if (!marker?.matches(".marp-run")) {
        code.tabIndex = 0;
        const observer = new ResizeObserver(() => refreshOverflow(code));
        observer.observe(code);
        refreshOverflow(code);
      }
      code.addEventListener('keydown', (event) => {
        if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','PageUp','PageDown','Home','End',' '].includes(event.key)) event.stopPropagation();
      });
      pre.addEventListener('wheel', (event) => {
        event.stopPropagation();
        const scroller = pre.querySelector('.marp-source-input') || code;
        if (scroller.scrollHeight > scroller.clientHeight || scroller.scrollWidth > scroller.clientWidth) {
          event.preventDefault();
          scroller.scrollTop += event.deltaY;
          scroller.scrollLeft += event.deltaX;
        }
      }, { passive: false });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
