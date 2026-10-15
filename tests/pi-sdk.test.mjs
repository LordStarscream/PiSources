import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import supervisor from '../extensions/worker-supervisor/index.ts';

let sdk, ai;
try { sdk = await import('@earendil-works/pi-coding-agent'); ai = await import('@earendil-works/pi-ai'); } catch {}
test('real Pi loader registers both extensions and real validator accepts their schemas', { skip: !sdk }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pi-loader-'));
  try {
    const loader = new sdk.DefaultResourceLoader({ cwd: dir, agentDir: dir,
      noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
      additionalExtensionPaths: [resolve('extensions/worker-supervisor/index.ts'), resolve('extensions/worker-guard/index.ts')] });
    await loader.reload();
    const result = loader.getExtensions();
    assert.deepEqual(result.errors, []);
    const names = result.extensions.flatMap(e => [...e.tools.keys()]);
    for (const n of ['start_worker', 'stop_worker', 'worker_status', 'continue_worker', 'worker_check']) assert.ok(names.includes(n));
    const tools = [];
    supervisor({ on() {}, events: { on() { return () => {}; } }, registerTool(t) { tools.push(t); } });
    const tool = tools.find(t => t.name === 'start_worker');
    const call = { type: 'toolCall', id: 'test', name: tool.name,
      arguments: { task: 'T2', cwd: dir, writablePaths: ['src/a.cs'] } };
    assert.deepEqual(ai.validateToolArguments(tool, call), call.arguments);
    assert.throws(() => ai.validateToolArguments(tool, { ...call, arguments: { ...call.arguments, unknown: true } }));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
