import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import supervisor from '../extensions/worker-supervisor/index.ts';
import guard from '../extensions/worker-guard/index.ts';
import { makeRecord, registry, MARKER, approve, stop } from '../extensions/worker-supervisor/runtime.mjs';

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

for (const action of ['continue', 'stop']) test(`real Pi parallel batch: twelve reads reach checkpoint then ${action}`, { skip: !sdk, timeout: 5000 }, async () => {
  const { runAgentLoop } = await import('@earendil-works/pi-agent-core');
  const root = mkdtempSync(join(tmpdir(), 'pi-parallel-'));
  const hooks = new Map(), definitions = new Map();
  guard({ on(name, handler) { hooks.set(name, handler); }, registerTool(tool) { definitions.set(tool.name, tool); } });
  mkdirSync(join(root, 'data'));
  for (let i = 1; i <= 12; i++) writeFileSync(join(root, 'data', `f${i}.txt`), `file ${i}\n`);
  let paused;
  const checkpoint = new Promise(resolve => { paused = resolve; });
  const record = makeRecord({ root, task: 'Read twelve files', paths: [], readOnly: true }, event => {
    if (event.kind === 'paused') paused();
  });
  const abort = new AbortController();
  const ctx = { cwd: root, abort() { abort.abort(); } };
  hooks.get('before_agent_start')({ prompt: MARKER + record.token, systemPrompt: 'PISOURCES_SUPERVISED_WORKER' }, ctx);
  const safety = setTimeout(() => stop(record, 'Regression test timed out'), 2500);
  try {
    const native = definitions.get('read');
    const tools = [{ ...native, execute: (id, args, signal, update) => native.execute(id, args, signal, update, ctx) }];
    const calls = Array.from({ length: 12 }, (_, i) => ai.fauxToolCall('read', { path: `data/f${i + 1}.txt` }, { id: `read-${i + 1}` }));
    const message = ai.fauxAssistantMessage(calls, { stopReason: 'toolUse' });
    let prepared = 0;
    const run = runAgentLoop([{ role: 'user', content: 'Read files', timestamp: Date.now() }], { messages: [], tools }, {
      model: ai.fauxProvider().getModel(), convertToLlm: messages => messages,
      toolExecution: 'parallel', finishTurn: () => ({ action: 'end' }),
      beforeToolCall: async ({ toolCall, args }) => {
        const result = await hooks.get('tool_call')({ toolCallId: toolCall.id, toolName: toolCall.name, input: args }, ctx);
        prepared++; return result;
      },
    }, () => {}, abort.signal, () => {
      const stream = ai.createAssistantMessageEventStream();
      stream.push({ type: 'done', reason: 'toolUse', message }); stream.end(message); return stream;
    });
    await checkpoint;
    // Pi really prepared the WHOLE batch before executing any of it.
    // Old guard blocked on hook 2 and never reached this checkpoint.
    assert.equal(prepared, 12);
    assert.equal(record.tools, 10); assert.equal(record.active, false);
    assert.equal(record.status, 'paused');
    const deadline = record.deadline;
    if (action === 'continue') approve(record, 'Ten reads, no changes, scope verified');
    else stop(record, 'Manual stop at checkpoint');
    const messages = await run;
    const results = messages.filter(m => m.role === 'toolResult');
    assert.equal(results.length, 12);
    assert.equal(record.tools, action === 'continue' ? 12 : 10);
    assert.equal(results.filter(m => !m.isError).length, action === 'continue' ? 12 : 10);
    assert.equal(record.active, false); assert.equal(record.deadline, deadline);
    hooks.get('agent_end')();
  } finally {
    clearTimeout(safety); stop(record, 'Test cleanup'); hooks.get('session_shutdown')();
    registry.delete(record.token); rmSync(root, { recursive: true, force: true });
  }
});
