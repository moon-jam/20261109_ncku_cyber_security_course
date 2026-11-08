'use strict';

// Reuse the package's compile/execute API so visible lifecycle phases are accurate.
const packageUrl = 'https://cdn.jsdelivr.net/npm/@live-codes/clang-wasm@0.3.0/';
self.onmessage = async ({ data }) => {
  let output = '';
  let toolchain;
  const append = (text) => {
    if (output.length + text.length > 64000) throw new Error('輸出超過 64,000 字。');
    output += text;
  };
  try {
    // This runtime can silently omit unsupported inline assembly. Refuse it explicitly.
    const tokens = data.source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, ' ');
    if (/\b(?:asm|__asm|__asm__)\b/.test(tokens)) throw new Error('此 Wasm 後端不支援 inline assembly。');
    console.info('[Marp runner] Clang 22.1.8 Wasm; assets ~29 MB', { package: packageUrl, language: data.language, std: data.std });
    self.postMessage({ type: 'status', status: 'Fetching…' });
    importScripts(packageUrl + 'dist/clang-wasm-toolchain.global.js');
    const { createToolchain, compilerDiagnostics, CLANG_DRIVER_DEFAULT_ARGS } = clangWasmToolchain;
    toolchain = await createToolchain({
      baseUrl: packageUrl + 'assets/',
      onProgress: (value) => console.debug('[Marp runner] asset progress', Math.round(value * 100) + '%'),
    });
    self.postMessage({ type: 'compiling' });
    const started = performance.now();
    const compiled = await toolchain.lock(() => toolchain.captureCompilerOutput(() =>
      toolchain.runtime.compileArtifact(data.source, {
        language: data.language === 'c' ? 'C' : 'CPP',
        fileName: data.language === 'c' ? 'main.c' : 'main.cpp',
        compileArgs: [...CLANG_DRIVER_DEFAULT_ARGS, '-std=' + data.std],
      })
    ));
    console.info('[Marp runner] compile time', Math.round(performance.now() - started), 'ms');
    if (compiled.raw) console.debug('[Marp runner] compiler diagnostics', compiled.raw);
    if (compiled.error) {
      const diagnostics = compilerDiagnostics(compiled.raw).join('\n') || String(compiled.error);
      self.postMessage({ output: diagnostics.slice(0, 64000), status: 'Compilation failed.' });
      return;
    }
    self.postMessage({ type: 'running' });
    let inputSent = false;
    const result = await toolchain.execute(compiled.result, {
      args: [],
      stdin: () => {
        if (inputSent || !data.stdin) return null;
        inputSent = true;
        return data.stdin;
      },
      stdout: append, stderr: append,
    });
    console.info('[Marp runner] exit code', result.exitCode);
    self.postMessage({ output, status: result.exitCode === 0 ? 'Done.' : `Exit ${result.exitCode}.` });
  } catch (error) {
    console.error('[Marp runner] Clang failed', error);
    self.postMessage({ output: output + String(error), status: 'Failed.' });
  } finally {
    toolchain?.dispose();
  }
};
