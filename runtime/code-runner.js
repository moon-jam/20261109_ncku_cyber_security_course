(() => {
  'use strict';

  const languages = {
    c: { label: 'C', std: 'gnu17' },
    cpp: { label: 'C++', std: 'gnu++17' },
    python: { label: 'Python' },
    javascript: { label: 'JavaScript' },
  };
  const aliases = { 'c++': 'cpp', js: 'javascript', py: 'python' };
  let activeCancel;

  function languageFor(className) {
    const match = /(?:^|\s)language-([^\s]+)/.exec(className);
    const name = aliases[match?.[1]] || match?.[1];
    return languages[name] ? name : null;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { languageFor };
    return;
  }

  const assets = new URL('.', document.currentScript.src);

  async function install() {
    // Marp's browser exports use its bare template. Only decorate interactive HTML.
    if (!document.querySelector('svg.bespoke-marp-slide')) return;
    const blocks = [];
    for (const marker of document.querySelectorAll('div.marp-run')) {
      const pre = marker.nextElementSibling;
      const code = pre?.matches('pre, marp-pre') ? pre.querySelector('code') : null;
      const language = code && languageFor(code.className);
      if (!language || pre.dataset.marpRunnable) continue;
      const config = languages[language];
      blocks.push({
        pre, language, source: code.textContent.replace(/\n$/, ''),
        std: marker.dataset.std || config.std,
        stdin: marker.dataset.stdin || '',
        hasInput: marker.hasAttribute('data-input') || marker.hasAttribute('data-stdin'),
      });
    }
    if (!blocks.length) return;

    const { createSourceModel, mountSourceEditor } = await import(new URL('source-editor.mjs', assets));

    for (const block of blocks) {
      const marker = block.pre.previousElementSibling;
      // Marp's auto-scaling shadow DOM measures static content. Editable code needs
      // ordinary layout so changes in line count and scroll position stay aligned.
      if (block.pre.localName === 'marp-pre' || block.pre.hasAttribute('is')) {
        const pre = document.createElement('pre');
        for (const { name, value } of block.pre.attributes) {
          if (!['is', 'data-auto-scaling'].includes(name)) pre.setAttribute(name, value);
        }
        pre.append(...block.pre.childNodes);
        block.pre.replaceWith(pre);
        block.pre = pre;
      }
      const sourceModel = createSourceModel(block.source);
      const slideEditor = mountSourceEditor(block.pre, block.pre.querySelector('code'), sourceModel, block.language,
        `投影片 ${languages[block.language].label} 程式碼`);
      const modal = marker.dataset.runner === 'dialog';
      const panel = document.createElement(modal ? 'dialog' : 'div');
      panel.className = modal ? 'marp-runner-dialog' : 'marp-runner-inline';
      const backend = languages[block.language].label;
      const id = `marp-runner-${blocks.indexOf(block)}`;
      const terminal = `
        <div class="marp-runner-terminal">
          <pre class="marp-runner-output" tabindex="0" aria-label="執行輸出"></pre>
          <form class="marp-runner-input">
            <label for="${id}-input">›</label>
            <textarea id="${id}-input" data-input aria-label="終端輸入" spellcheck="false" rows="2" placeholder="Input…" title="Ctrl / ⌘ + Enter to run"></textarea>
            <button type="submit" data-action="submit" aria-label="送出輸入">↵</button>
          </form>
        </div><p class="marp-runner-status" role="status" aria-live="polite"></p>`;
      panel.innerHTML = modal ? `
        <header><h2 id="${id}-title"></h2><button type="button" data-action="close">關閉</button></header>
        <pre class="marp-dialog-source"><code data-source></code></pre>
        ${terminal}
        <footer><button type="button" data-action="run">執行</button><button type="button" data-action="stop" disabled>停止</button><button type="button" data-action="reset">重設</button></footer>` : `
        ${terminal}`;
      if (modal) {
        panel.setAttribute('aria-labelledby', `${id}-title`);
        panel.querySelector('h2').textContent = backend;
        document.body.append(panel);
      } else {
        panel.hidden = true;
        const wrapper = document.createElement('div');
        wrapper.className = 'marp-code-container';
        block.pre.before(wrapper);
        wrapper.append(block.pre, panel);
      }
      panel.dataset.theme = block.pre.closest('section')?.classList.contains('invert') ? 'dark' : 'light';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'marp-code-run-button';
      button.textContent = '▷';
      const label = `執行 ${languages[block.language].label} 程式碼`;
      button.title = label;
      button.setAttribute('aria-label', label);
      block.pre.classList.add('marp-runnable');
      block.pre.dataset.marpRunnable = 'true';
      block.pre.append(button);

      let outputToggle;
      if (!modal) {
        panel.id = `${id}-panel`;
        outputToggle = document.createElement('button');
        outputToggle.type = 'button';
        outputToggle.className = 'marp-code-output-toggle';
        outputToggle.hidden = true;
        outputToggle.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="m6 15 6-6 6 6" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
        outputToggle.setAttribute('aria-controls', panel.id);
        block.pre.append(outputToggle);
        outputToggle.addEventListener('click', (event) => {
          event.stopPropagation();
          showInlineResult(panel.hidden);
        });
      }

      function showInlineResult(expanded) {
        if (modal) return;
        panel.hidden = !expanded;
        outputToggle.hidden = false;
        outputToggle.setAttribute('aria-expanded', String(expanded));
        const label = expanded ? '收合執行結果' : '展開執行結果';
        outputToggle.setAttribute('aria-label', label);
        outputToggle.title = label;
      }

      const editor = modal ? mountSourceEditor(panel.querySelector('.marp-dialog-source'), panel.querySelector('[data-source]'),
        sourceModel, block.language, '程式碼') : null;
      const input = panel.querySelector('[data-input]');
      const inputForm = panel.querySelector('.marp-runner-input');
      const submitButton = panel.querySelector('[data-action="submit"]');
      const output = panel.querySelector('.marp-runner-output');
      const status = panel.querySelector('.marp-runner-status');
      const runButton = modal ? panel.querySelector('[data-action="run"]') : button;
      const stopButton = modal ? panel.querySelector('[data-action="stop"]') : button;
      const resetButton = panel.querySelector('[data-action="reset"]');
      if (modal) stopButton.textContent = '停止';
      input.value = block.stdin;
      let worker, timer, job = 0;
      let awaitingInput = block.hasInput && !modal;
      inputForm.hidden = !block.hasInput && !modal;

      function busy(value) {
        if (modal) { runButton.disabled = value; stopButton.disabled = !value; }
        else {
          button.textContent = value ? '□' : '▷';
          button.setAttribute('aria-label', value ? '停止執行' : label);
          button.title = value ? '停止執行' : label;
        }
        if (resetButton) resetButton.disabled = value;
        if (editor) editor.readOnly = value;
        slideEditor.readOnly = value;
        input.readOnly = value;
        submitButton.disabled = value;
      }

      function cancel(message) {
        if (typeof message === 'string') { status.hidden = false; status.textContent = message; }
        job++;
        clearTimeout(timer);
        if (activeCancel === cancel) activeCancel = null;
        worker?.terminate();
        worker = null;
        busy(false);
      }

      function finish(result) {
        clearTimeout(timer);
        if (activeCancel === cancel) activeCancel = null;
        worker?.terminate();
        worker = null;
        console.info('[Marp runner]', block.language, result.status);
        output.textContent = result.output;
        status.textContent = result.status;
        status.hidden = result.status === 'Done.';
        busy(false);
      }

      async function run() {
        activeCancel?.('Stopped.');
        cancel();
        activeCancel = cancel;
        const requestId = job;
        awaitingInput = false;
        showInlineResult(true);
        busy(true);
        output.textContent = '';
        status.hidden = false;
        status.textContent = block.language === 'javascript' ? 'Running…' : 'Fetching…';
        const timeout = (milliseconds, message) => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            cancel(); status.textContent = 'Timed out.';
            console.warn('[Marp runner]', block.language, message);
          }, milliseconds);
        };
        timeout(block.language === 'javascript' ? 10000 : 120000, block.language === 'javascript' ? '超過 10 秒，已停止。' : '載入超過 120 秒，已停止。');
        try {
          const name = block.language === 'javascript' ? 'javascript-worker.js'
            : block.language === 'python' ? 'python-worker.js' : 'clang-worker.js';
          worker = new Worker(new URL(name, assets), block.language === 'python' ? { type: 'module' } : undefined);
          worker.onmessage = ({ data }) => {
            if (requestId !== job) return;
            if (data.type === 'status') status.textContent = data.status;
            else if (data.type === 'compiling') { status.textContent = 'Compiling…'; timeout(30000, '編譯超過 30 秒，已停止。'); }
            else if (data.type === 'running') { status.textContent = 'Running…'; timeout(10000, '超過 10 秒，已停止。'); }
            else finish(data);
          };
          worker.onerror = (event) => {
            if (requestId === job) finish({ output: event.message, status: 'Failed.' });
          };
          worker.postMessage({ language: block.language, std: block.std, source: sourceModel.value, stdin: input.value });
        } catch (error) {
          if (requestId === job) finish({ output: error.message, status: 'Failed.' });
        }
      }

      inputForm.addEventListener('submit', (event) => {
        event.preventDefault();
        if (!worker) run();
      });
      if (modal) runButton.addEventListener('click', run);
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        if (modal) panel.showModal();
        else if (worker) {
          cancel();
          showInlineResult(true);
          status.hidden = false;
          status.textContent = 'Stopped.';
        } else if (panel.hidden && awaitingInput) {
          showInlineResult(true);
          status.hidden = true;
          input.focus();
        } else { run(); }
      });
      if (modal) stopButton.addEventListener('click', () => {
        cancel();
        status.textContent = 'Stopped.';
      });
      resetButton?.addEventListener('click', () => {
        sourceModel.reset();
        input.value = block.stdin;
        output.textContent = '';
        status.textContent = '';
      });
      panel.querySelector('[data-action="close"]')?.addEventListener('click', () => {
        if (modal) panel.close();
        else { cancel(); panel.hidden = true; }
      });
      if (modal) panel.addEventListener('close', cancel);
      panel.addEventListener('click', (event) => event.stopPropagation());
      block.pre.addEventListener('click', (event) => event.stopPropagation());
      // Keep native editing keys within either source view and the terminal input.
      document.addEventListener('keydown', (event) => {
        if (!(modal ? panel.open : panel.contains(event.target)) &&
            ![slideEditor, button, outputToggle].includes(event.target)) return;
        if (event.key === 'Tab') return; // Allow focus traversal and the editor's indent handler.
        event.stopImmediatePropagation();
        if ([input, slideEditor, editor].includes(event.target) && event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          if (modal && !panel.open) panel.showModal();
          else if (!modal) showInlineResult(true);
          inputForm.requestSubmit();
        }
        if (modal && event.key === 'Escape') {
          event.preventDefault();
          panel.close();
        }
      }, true);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
