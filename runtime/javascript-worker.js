'use strict';

self.onmessage = async ({ data }) => {
  let output = '';
  const limit = 64000;
  const write = (...values) => {
    const text = values.map((value) => {
      if (typeof value === 'string') return value;
      try { return JSON.stringify(value) ?? String(value); }
      catch { return String(value); }
    }).join(' ') + '\n';
    if (output.length + text.length > limit) throw new Error('輸出超過 64,000 字。');
    output += text;
  };
  const lines = data.stdin ? data.stdin.replace(/\r/g, '').replace(/\n$/, '').split('\n') : [];
  const readline = () => lines.shift();
  const console = { log: write, info: write, warn: write, error: write, debug: write };
  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    await new AsyncFunction('console', 'readline', data.source)(console, readline);
    self.postMessage({ status: 'Done.', output });
  } catch (error) {
    self.postMessage({ status: 'Failed.', output: output + String(error) });
  }
};
