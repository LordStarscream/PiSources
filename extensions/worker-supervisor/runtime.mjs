import { realpathSync, existsSync, lstatSync } from 'node:fs';
import { resolve, relative, dirname, basename, isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';

// Shared by parent and in-process child extension instances, not an OS sandbox.
const KEY = Symbol.for('pisources:supervised-workers:v1');
export const registry = globalThis[KEY] ??= new Map();
export const MARKER = 'PISOURCES_WORKER_CONTRACT=';
export const BUILTINS = new Set(['read', 'grep', 'find', 'ls', 'write', 'edit']);
export function canonical(path) {
  const absolute = resolve(path);
  // A dangling symlink must not turn into a seemingly safe new file.
  let entry;
  try { entry = lstatSync(absolute); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (entry?.isSymbolicLink()) return realpathSync(absolute);
  if (existsSync(absolute)) return realpathSync(absolute);
  const parent = dirname(absolute);
  if (parent === absolute) throw new Error('Cannot resolve path');
  return resolve(canonical(parent), basename(absolute));
}
export function within(root, path) {
  const rel = relative(root, path);
  return rel === '' || (rel.split(/[\\/]/)[0] !== '..' && !isAbsolute(rel));
}
export function projectPath(record, path) {
  if (typeof path !== 'string') throw new Error('Missing path');
  const target = canonical(resolve(record.root, path));
  if (!within(record.root, target)) throw new Error('Path outside assigned worktree');
  if (relative(record.root, target).split(/[\\/]/).some(p => ['.git', '.pi', '.tasks'].includes(p))) {
    throw new Error('Control/Git/task files are protected');
  }
  return target;
}
export function makeRecord({ root, task, paths, readOnly = false, checks = [] }, notify = () => {}, now = Date.now()) {
  if (!isAbsolute(root) || !existsSync(root) || !task?.trim()) throw new Error('Existing absolute cwd and task required');
  const record = {
    token: randomUUID(), root: canonical(root), task, readOnly, checks,
    createdAt: now, deadline: now + 20 * 60_000, maxTools: 80, tools: 0,
    checkpointTools: 10, sinceCheckpoint: 0, nextCheckpoint: now + 5 * 60_000,
    status: 'starting', stopped: false, active: false, attached: false,
    waiters: [], idleWaiters: [], notify, audit: [], writes: new Set(), checksRun: new Map(), processes: new Set(),
  };
  record.paths = (paths ?? []).map(p => {
    if (!p || resolve(record.root, p) === record.root) throw new Error('Write scopes must be narrower than project root');
    return { path: projectPath(record, p), directory: /[\\/]$/.test(p) };
  });
  if (!readOnly && !record.paths.length) throw new Error('Explicit writable paths required');
  const ids = new Set();
  for (const check of checks) {
    if (!check.id || ids.has(check.id)) throw new Error('Check IDs must be unique');
    ids.add(check.id);
    if (!isAbsolute(check.executable) || !existsSync(check.executable) || !Array.isArray(check.args) || check.args.some(a => typeof a !== 'string')) {
      throw new Error('Checks require an existing absolute executable and string argv');
    }
    check.timeoutSeconds = Math.min(600, Math.max(1, check.timeoutSeconds ?? 120));
  }
  registry.set(record.token, record);
  return record;
}
export function permit(record, name, input = {}) {
  if (record.stopped) throw new Error('Worker stopped; no further tools allowed');
  if (name === 'worker_check') return;
  if (!BUILTINS.has(name)) throw new Error('Tool not allowed for supervised workers: ' + name);
  const target = projectPath(record, input.path ?? '.');
  if (name === 'write' || name === 'edit') {
    if (record.readOnly || !record.paths.some(p => p.directory ? within(p.path, target) : p.path === target)) {
      throw new Error('Write outside assigned scope');
    }
  }
}
export function checkpoint(record, reason) {
  if (record.stopped || record.status === 'paused' || record.status === 'pause-requested') return;
  record.status = 'pause-requested';
  record.notify({ kind: 'checkpoint-requested', reason });
}
export function tick(record, now = Date.now()) {
  if (record.stopped) return;
  if (now >= record.deadline) return stop(record, 'Wall-clock budget exceeded');
  if (record.active && now >= record.toolDeadline) return stop(record, 'Active tool timeout exceeded');
  if (!record.attached && now - record.createdAt >= 30_000) return stop(record, 'Worker guard did not attach');
  if (now >= record.nextCheckpoint) checkpoint(record, 'Five-minute checkpoint');
}
export async function beforeTool(record, name, input, now = Date.now()) {
  // Serialize parallel tool batches so a checkpoint really is between tools.
  while (record.active && !record.stopped) await new Promise(resolve => record.idleWaiters.push(resolve));
  now = Math.max(now, Date.now());
  tick(record, now);
  permit(record, name, input);
  if (record.tools >= record.maxTools) { stop(record, 'Tool budget exceeded'); throw new Error(record.reason); }
  if (record.sinceCheckpoint >= record.checkpointTools) checkpoint(record, 'Tool checkpoint');
  if (record.status === 'pause-requested') {
    record.status = 'paused';
    const wait = new Promise(resolve => record.waiters.push(resolve));
    record.notify({ kind: 'paused', reason: 'Paused before next tool; inspect diff and audit before continuing' });
    await wait;
    tick(record);
    permit(record, name, input);
  }
  record.tools++;
  record.sinceCheckpoint++;
  record.active = true;
  record.toolDeadline = now + (name === 'worker_check' ?
    (record.checks.find(c => c.id === input.id)?.timeoutSeconds ?? 120) * 1000 : 30_000);
  record.audit.push({ kind: 'tool', tool: name, path: input.path, check: input.id, at: now });
  if (name === 'write' || name === 'edit') record.writes.add(projectPath(record, input.path));
  if (record.audit.length > 100) record.audit.splice(0, record.audit.length - 100);
}
export function finishTool(record) {
  record.active = false;
  for (const resolve of record.idleWaiters.splice(0)) resolve();
}
export function stop(record, reason = 'Stopped by controller') {
  if (record.stopped) return;
  record.stopped = true;
  record.status = 'stop-requested';
  record.reason = reason;
  for (const resolve of record.waiters.splice(0)) resolve();
  for (const resolve of record.idleWaiters.splice(0)) resolve();
  for (const child of record.processes) terminate(child);
  record.abort?.();
  record.notify({ kind: 'stop-requested', reason });
}
export function closeRecord(record) {
  // Normal completion revokes the contract WITHOUT aborting a successful run.
  record.stopped = true;
  record.status = 'finished';
  for (const resolve of [...record.waiters.splice(0), ...record.idleWaiters.splice(0)]) resolve();
  for (const child of record.processes) terminate(child);
}
export function approve(record, rationale, now = Date.now()) {
  if (record.stopped || record.status !== 'paused') throw new Error('Only a paused live worker can continue');
  if (!rationale?.trim()) throw new Error('A review rationale is required');
  record.audit.push({ kind: 'approved', rationale, at: now });
  record.status = 'running';
  record.sinceCheckpoint = 0;
  record.nextCheckpoint = now + 5 * 60_000;
  for (const resolve of record.waiters.splice(0)) resolve();
}
export function terminate(child) {
  const signal = name => {
    try { if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, name); else child.kill(name); } catch {}
  };
  signal('SIGTERM');
  const timer = setTimeout(() => signal('SIGKILL'), 1500);
  timer.unref?.();
}
export function summary(r) {
  return { id: r.id, token: r.token, task: r.task, cwd: r.root, status: r.status,
    guardAttached: r.attached, activeTool: r.active, tools: r.tools, maxTools: r.maxTools,
    deadline: new Date(r.deadline).toISOString(), reason: r.reason,
    writes: [...r.writes], recentActivity: r.audit.slice(-15) };
}
