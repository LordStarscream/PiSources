import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import { spawnSync } from 'node:child_process';
import { makeRecord, permit, beforeTool, finishTool, approve, stop, tick, registry, MARKER } from '../extensions/worker-supervisor/runtime.mjs';
import guard from '../extensions/worker-guard/index.ts';
import supervisor from '../extensions/worker-supervisor/index.ts';

const dirs = [];
afterEach(() => { for (const r of registry.values()) stop(r, 'Test cleanup'); registry.clear(); for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
function setup(extra = {}, notify) {
  const root = mkdtempSync(join(tmpdir(), 'pi-workers-')); dirs.push(root); mkdirSync(join(root, 'src'));
  return makeRecord({ root, task: 'Only implement T2', paths: ['src/'], ...extra }, notify);
}
function api(events = bus()) {
  const handlers = new Map(), tools = new Map(), notifications = [];
  return { handlers, tools, notifications, events,
    on(n, f) { handlers.set(n, f); }, registerTool(t) { tools.set(t.name, t); },
    sendMessage(m, options) { notifications.push({ ...m, options }); },
    async exec(cmd, args, opts) { const r = spawnSync(cmd, args, { cwd: opts.cwd, encoding: 'utf8', timeout: opts.timeout }); return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }; },
  };
}
function bus() {
  const e = new EventEmitter();
  return { on(n, f) { e.on(n, f); return () => e.off(n, f); }, emit(n, v) { e.emit(n, v); } };
}

test('only assigned files can be written; control files and unrestricted tools denied', () => {
  const r = setup(); permit(r, 'write', { path: 'src/a.cs' });
  for (const path of ['../escape', '.tasks/task.md', '.pi/state', '.git/config', 'frontend/a.ts']) assert.throws(() => permit(r, 'write', { path }));
  for (const name of ['bash', 'Agent', 'SubagentWorkflow', 'gpt_chat']) assert.throws(() => permit(r, name));
  assert.throws(() => permit(r, 'read', { path: '/' }));
});
test('read-only reviewers cannot write and root-wide write grants are refused', () => {
  const r = setup({ readOnly: true }); assert.throws(() => permit(r, 'edit', { path: 'src/a' }));
  assert.throws(() => makeRecord({ root: r.root, task: 'x', paths: ['.'] }));
});
test('symlink and dangling-symlink escapes are denied', () => {
  const r = setup(), other = setup();
  symlinkSync(other.root, join(r.root, 'src', 'outside'));
  assert.throws(() => permit(r, 'write', { path: 'src/outside/a' }));
  symlinkSync(join(other.root, 'missing'), join(r.root, 'src', 'dangling'));
  assert.throws(() => permit(r, 'write', { path: 'src/dangling' }));
});
test('checkpoint blocks before next tool, approval does not reset budgets', async () => {
  const r = setup(); r.attached = true; r.checkpointTools = 1;
  await beforeTool(r, 'read', { path: 'src' }); finishTool(r);
  const deadline = r.deadline;
  const waiting = beforeTool(r, 'write', { path: 'src/a' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(r.status, 'paused'); assert.equal(r.tools, 1);
  approve(r, 'Reviewed diff, T2 scope still correct'); await waiting;
  assert.equal(r.tools, 2); assert.equal(r.deadline, deadline); finishTool(r);
});
test('stop wakes a paused tool without executing it', async () => {
  const r = setup(); r.attached = true; r.status = 'pause-requested';
  const waiting = beforeTool(r, 'write', { path: 'src/a' });
  stop(r, 'User cancelled'); await assert.rejects(waiting, /stopped/);
  assert.equal(r.tools, 0); assert.throws(() => approve(r, 'resume'));
});
test('concurrent calls serialize and cancellation releases queued calls', async () => {
  const r = setup(); r.attached = true;
  await beforeTool(r, 'read', { path: 'src' });
  const waiting = beforeTool(r, 'read', { path: 'src' });
  assert.equal(r.tools, 1); stop(r); await assert.rejects(waiting); finishTool(r);
});
test('hard wall-clock and total-tool ceilings abort independently of progress', async () => {
  const r = setup(); r.attached = true; let aborted = false; r.abort = () => { aborted = true; };
  tick(r, r.deadline); assert.equal(aborted, true);
  const s = setup(); s.attached = true; s.tools = s.maxTools;
  await assert.rejects(beforeTool(s, 'read', { path: 'src' }), /budget/);
  assert.equal(s.stopped, true);
});
test('missing guard handshake expires and stopped contract stays closed', () => {
  const r = setup(); tick(r, r.createdAt + 30_001); assert.equal(r.stopped, true);
  assert.throws(() => permit(r, 'read', { path: 'src' }));
});
test('active read/search timeout aborts even without a completed turn', async () => {
  const r = setup(); r.attached = true;
  await beforeTool(r, 'find', { path: '.', pattern: '*.cs' });
  tick(r, r.toolDeadline); assert.equal(r.stopped, true);
  assert.match(r.reason, /tool timeout/);
});
test('normal completion closes the contract without issuing abort', () => {
  const r = setup(); const pi = api(); guard(pi); let aborts = 0;
  r.abort = () => { aborts++; };
  pi.handlers.get('before_agent_start')({ prompt: MARKER + r.token, systemPrompt: 'PISOURCES_SUPERVISED_WORKER' }, { abort() { aborts++; } });
  pi.handlers.get('agent_end')();
  assert.equal(aborts, 0); assert.equal(r.stopped, true);
  assert.throws(() => permit(r, 'write', { path: 'src/a' }));
  pi.handlers.get('session_shutdown')();
});
test('guard is fail-closed without contract and blocks an out-of-scope write', async () => {
  const pi = api(); guard(pi); const ctx = { abort() {} };
  pi.handlers.get('before_agent_start')({ prompt: '', systemPrompt: 'PISOURCES_SUPERVISED_WORKER' }, ctx);
  assert.equal((await pi.handlers.get('tool_call')({ toolName: 'write', input: { path: 'a' } }, ctx)).block, true);
  const r = setup();
  pi.handlers.get('before_agent_start')({ prompt: MARKER + r.token, systemPrompt: 'PISOURCES_SUPERVISED_WORKER' }, ctx);
  const result = await pi.handlers.get('tool_call')({ toolCallId: 'bad', toolName: 'write', input: { path: 'frontend/a' } }, ctx);
  assert.equal(result.block, true); assert.equal(r.stopped, true);
  pi.handlers.get('session_shutdown')();
});
test('worker check preserves failure, bounds output and enforces attempt budget', async () => {
  const r = setup({ checks: [{ id: 'unit', executable: process.execPath, args: ['-e', 'console.log("x".repeat(20000)); process.exit(7)'] }] });
  const pi = api(); guard(pi); pi.handlers.get('before_agent_start')({ prompt: MARKER + r.token, systemPrompt: 'PISOURCES_SUPERVISED_WORKER' }, { abort() {} });
  const check = pi.tools.get('worker_check');
  const result = await check.execute('', { id: 'unit' });
  assert.equal(result.details.code, 7); assert.equal(result.isError, true); assert.ok(result.details.output.length <= 16000);
  await check.execute('', { id: 'unit' });
  await assert.rejects(check.execute('', { id: 'unit' }), /budget/);
  await assert.rejects(check.execute('', { id: 'shell' }), /Unknown/);
  pi.handlers.get('session_shutdown')();
});
test('worker check timeout ends a silent process', async () => {
  const r = setup({ checks: [{ id: 'hang', executable: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'], timeoutSeconds: 1 }] });
  const pi = api(); guard(pi); pi.handlers.get('before_agent_start')({ prompt: MARKER + r.token, systemPrompt: 'PISOURCES_SUPERVISED_WORKER' }, { abort() {} });
  const start = Date.now(); const result = await pi.tools.get('worker_check').execute('', { id: 'hang' });
  assert.equal(result.details.timedOut, true); assert.equal(result.isError, true); assert.ok(Date.now() - start < 5000);
  pi.handlers.get('session_shutdown')();
});
test('supervisor spawns through RPC in a separate worktree, exposes stop and blocks raw delegation', async () => {
  const base = setup().root; spawnSync('git', ['init', base]);
  writeFileSync(join(base, 'a'), 'base');
  spawnSync('git', ['-C', base, 'add', 'a']);
  spawnSync('git', ['-C', base, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-m', 'initial']);
  const tree = join(base, 'worker-tree'); spawnSync('git', ['-C', base, 'worktree', 'add', tree, '-b', 'worker']);
  const pi = api(); supervisor(pi); let payload, stopped = false;
  for (const method of ['ping', 'spawn', 'stop']) pi.events.on('subagents:rpc:' + method, p => {
    if (method === 'spawn') payload = p;
    if (method === 'stop') stopped = true;
    pi.events.emit(`subagents:rpc:${method}:reply:${p.requestId}`, { success: true, data: method === 'spawn' ? { id: 'w1' } : { version: 2 } });
  });
  pi.handlers.get('session_start')();
  const checkDir = join(base, '.pi', 'agents'); mkdirSync(checkDir, { recursive: true });
  writeFileSync(join(checkDir, 'supervised-worker.md'), '---\nname: supervised-worker\ntools: bash\n---\nunsafe');
  await assert.rejects(pi.tools.get('start_worker').execute('', { task: 'T2', cwd: tree, writablePaths: ['src/'] }, null, null, { cwd: base }), /Unsafe/);
  rmSync(join(checkDir, 'supervised-worker.md'));
  assert.equal(pi.handlers.get('tool_call')({ toolName: 'Agent' }).block, true);
  assert.equal(pi.handlers.get('tool_call')({ toolName: 'get_subagent_result', input: { wait: true } }).block, true);
  assert.equal(pi.handlers.get('tool_call')({ toolName: 'get_subagent_result', input: { wait: false } }), undefined);
  await assert.rejects(pi.tools.get('start_worker').execute('', { task: 'T2', cwd: base, writablePaths: ['src/'] }, null, null, { cwd: base }), /separate/);
  const result = await pi.tools.get('start_worker').execute('', { task: 'T2 only', cwd: tree, writablePaths: ['src/'] }, null, null, { cwd: base });
  assert.equal(result.details.id, 'w1'); assert.equal(payload.options.maxTurns, 40); assert.equal(payload.options.isolation, 'off');
  await pi.tools.get('stop_worker').execute('', { id: 'w1', reason: 'scope violation' });
  assert.equal(stopped, true); assert.equal(payload.options.signal.aborted, true);
  pi.handlers.get('session_shutdown')();
});


async function notificationFixture(t) {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const base = setup().root;
  spawnSync('git', ['init', base]);
  writeFileSync(join(base, 'a'), 'base');
  spawnSync('git', ['-C', base, 'add', 'a']);
  spawnSync('git', ['-C', base, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-m', 'initial']);
  const tree = join(base, 'worker-tree');
  spawnSync('git', ['-C', base, 'worktree', 'add', tree, '-b', 'worker']);
  const pi = api(); supervisor(pi);
  const state = { idle: false, queued: false };
  const ctx = { cwd: base, isIdle: () => state.idle, hasPendingMessages: () => state.queued };
  for (const method of ['ping', 'spawn', 'stop']) pi.events.on('subagents:rpc:' + method, p => {
    pi.events.emit(`subagents:rpc:${method}:reply:${p.requestId}`, { success: true, data: { id: 'notify-worker' } });
  });
  pi.handlers.get('session_start')({}, ctx);
  t.after(() => pi.handlers.get('session_shutdown')());
  const result = await pi.tools.get('start_worker').execute('', { task: 'Read files', cwd: tree, writablePaths: [], readOnly: true }, null, null, ctx);
  const record = registry.get(result.details.token);
  record.attached = true; record.checkpointTools = 1;
  async function pause() {
    await beforeTool(record, 'read', { path: 'a' }); finishTool(record);
    const waiting = beforeTool(record, 'read', { path: 'a' });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(record.status, 'paused');
    return { waiting };
  }
  return { pi, record, state, pause, poll: () => t.mock.timers.tick(1000) };
}

test('notifications wait for idle, discard reviewed checkpoints and deliver each live checkpoint once', async t => {
  const { pi, record, state, pause, poll } = await notificationFixture(t);
  const first = await pause(); poll();
  assert.equal(pi.notifications.length, 0); // Busy controller: nothing enters Pi's queue.
  await pi.tools.get('continue_worker').execute('', { id: record.id, review: 'Read-only audit reviewed' });
  await first.waiting; finishTool(record);
  state.idle = true; poll();
  assert.equal(pi.notifications.length, 0); // Already handled pause is gone.
  record.status = 'pause-requested';
  const waiting = beforeTool(record, 'read', { path: 'a' });
  await new Promise(resolve => setImmediate(resolve));
  state.queued = true; poll(); assert.equal(pi.notifications.length, 0);
  state.queued = false; poll(); poll();
  assert.equal(pi.notifications.length, 1);
  const message = pi.notifications[0], payload = JSON.parse(message.content);
  assert.equal(payload.kind, 'paused'); assert.equal(payload.worker.id, record.id);
  assert.equal(payload.worker.status, 'paused'); assert.equal(payload.sequence, 3);
  assert.equal(message.options.triggerTurn, true); assert.equal(message.options.deliverAs, undefined);
  await pi.tools.get('stop_worker').execute('', { id: record.id, reason: 'Controller reviewed and stopped' });
  await assert.rejects(waiting, /stopped/);
  poll(); assert.equal(pi.notifications.length, 1); // Own stop does not wake controller again.
});

test('notifications discard terminal checkpoints, but retain autonomous budget stops until controller is idle', async t => {
  const { pi, record, state, pause, poll } = await notificationFixture(t);
  const { waiting } = await pause();
  // A watchdog stop supersedes the pending checkpoint while the controller is busy.
  tick(record, record.deadline);
  await assert.rejects(waiting, /stopped/);
  poll(); assert.equal(pi.notifications.length, 0);
  state.idle = true; poll(); poll();
  assert.equal(pi.notifications.length, 1);
  const payload = JSON.parse(pi.notifications[0].content);
  assert.equal(payload.kind, 'stop-requested'); assert.equal(payload.sequence, 3);
  assert.match(payload.reason, /Wall-clock/);
  assert.equal(payload.worker.status, 'stop-requested');
  pi.events.emit('subagents:failed', { id: record.id, status: 'stopped' });
  poll(); assert.equal(pi.notifications.length, 1);
});

test('settlement drops an undelivered pause and shutdown does not notify the controller', async t => {
  const { pi, record, state, pause, poll } = await notificationFixture(t);
  const { waiting } = await pause();
  pi.events.emit('subagents:completed', { id: record.id, status: 'completed' });
  await assert.rejects(waiting, /stopped/);
  state.idle = true; poll(); assert.equal(pi.notifications.length, 0);
  pi.handlers.get('session_shutdown')(); poll();
  assert.equal(pi.notifications.length, 0);
});
