const indexURL = 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/';
self.onmessage = async ({ data }) => {
  let output = '';
  const append = (text) => {
    if (output.length + text.length > 64000) throw new Error('輸出超過 64,000 字。');
    output += text;
  };
  try {
    console.info('[Marp runner] Pyodide 314.0.7; core ~14 MB', indexURL);
    const { loadPyodide } = await import(indexURL + 'pyodide.mjs');
    const lines = data.stdin ? data.stdin.replace(/\r/g, '').replace(/\n$/, '').split('\n') : [];
    const pyodide = await loadPyodide({ indexURL });
    pyodide.setStdin({ stdin: () => lines.shift() ?? null });
    pyodide.setStdout({ batched: (text) => append(text + '\n') });
    pyodide.setStderr({ batched: (text) => append(text + '\n') });
    self.postMessage({ type: 'running' });
    try { await pyodide.runPythonAsync(data.source); }
    finally { pyodide.runPython('import sys; sys.stdout.flush(); sys.stderr.flush()'); }
    self.postMessage({ output, status: 'Done.' });
  } catch (error) {
    console.error('[Marp runner] Python failed', error);
    self.postMessage({ output: output + String(error), status: 'Failed.' });
  }
};
