import hljs from './vendor/highlight/core.mjs';
import c from './vendor/highlight/c.mjs';
import cpp from './vendor/highlight/cpp.mjs';
import python from './vendor/highlight/python.mjs';
import javascript from './vendor/highlight/javascript.mjs';

for (const [name, grammar] of Object.entries({ c, cpp, python, javascript })) hljs.registerLanguage(name, grammar);

export function highlightedSource(source, language) {
  return hljs.highlight(source, { language, ignoreIllegals: true }).value;
}

// One plain-text value per block: every view and every execution reads this value.
export function createSourceModel(initial) {
  let value = initial;
  const listeners = new Set();
  return {
    get value() { return value; },
    set(next) {
      if (value === next) return;
      value = next;
      for (const listener of listeners) listener(value);
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(value);
      return () => listeners.delete(listener);
    },
    reset() { this.set(initial); },
  };
}

export function mountSourceEditor(host, code, model, language, label) {
  const surface = document.createElement('div');
  surface.className = 'marp-source-editor';
  code.before(surface);
  surface.append(code);
  code.setAttribute('aria-hidden', 'true');
  const textarea = document.createElement('textarea');
  textarea.className = 'marp-source-input';
  textarea.setAttribute('aria-label', label);
  textarea.spellcheck = false;
  textarea.wrap = 'off';
  textarea.autocomplete = 'off';
  textarea.autocapitalize = 'off';
  textarea.value = model.value;
  surface.append(textarea);
  const syncScroll = () => {
    code.scrollTop = textarea.scrollTop;
    code.scrollLeft = textarea.scrollLeft;
  };
  model.subscribe((value) => {
    if (textarea.value !== value) textarea.value = value;
    // Highlight.js escapes source text before producing its span markup.
    code.innerHTML = highlightedSource(value, language) + (!value || value.endsWith('\n') ? ' ' : '');
    window.marpRefreshCodeOverflow?.(textarea);
    syncScroll();
  });
  textarea.addEventListener('input', () => model.set(textarea.value));
  textarea.addEventListener('scroll', syncScroll);
  textarea.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab' || event.shiftKey || textarea.readOnly) return;
    event.preventDefault();
    textarea.setRangeText('  ', textarea.selectionStart, textarea.selectionEnd, 'end');
    model.set(textarea.value);
  });
  host.classList.add('marp-editable-source');
  const observer = new ResizeObserver(() => {
    window.marpRefreshCodeOverflow?.(textarea);
    syncScroll();
  });
  observer.observe(surface);
  return textarea;
}
