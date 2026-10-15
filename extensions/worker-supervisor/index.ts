import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';
import { makeRecord, registry, MARKER, summary, stop, closeRecord, approve, tick } from './runtime.mjs';

const object = (properties: any, required: string[]) => ({ type: 'object', properties, required, additionalProperties: false }) as any;
const string = { type: 'string' };
const reply = (data: any) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }], details: data });

// Match the extension's project > workspace > global > package precedence.
// Require our conservative profile format; no silent generic-agent fallback.
function validateProfile(cwd: string, readOnly: boolean) {
  const name = readOnly ? 'supervised-reviewer' : 'supervised-worker';
  const candidates = [join(cwd, '.pi', 'agents', name + '.md'), join(cwd, '.agents', 'agents', name + '.md'),
    join(process.env.PI_CODING_AGENT_DIR || join(homedir(), '.pi', 'agent'), 'agents', name + '.md'),
    new URL(`../../docs/agents/${name}.md`, import.meta.url)];
  const file = candidates.find(p => existsSync(p));
  if (!file) throw new Error('Install the supervised agent profiles before starting workers');
  const text = readFileSync(file, 'utf8');
  const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
  const field = (key: string) => frontmatter.match(new RegExp(`^${key}:\\s*(.*?)\\s*$`, 'm'))?.[1].replace(/^["']|["']$/g, '');
  const tools = readOnly ? 'read, grep, find, ls' : 'read, grep, find, ls, edit, write, ext:worker-guard/worker_check';
  if (field('name') !== name || field('extensions') !== '[worker-guard]' || field('skills') !== 'false' ||
      field('prompt_mode') !== 'replace' || field('inherit_context') !== 'false' || field('max_turns') !== '40' ||
      field('allowed_subagents') !== 'none' || field('isolation') !== 'off' || field('tools') !== tools ||
      !text.includes('PISOURCES_SUPERVISED_WORKER')) {
    throw new Error('Unsafe/shadowing supervised agent profile; restore the shipped definition: ' + String(file));
  }
}

export default function (pi: ExtensionAPI) {
  const owned = new Map<string, any>();
  let spawnPending = false;
  let watchdog: ReturnType<typeof setInterval> | undefined;
  function rpc(method: string, payload: any = {}, milliseconds = 3000): Promise<any> {
    const requestId = randomUUID();
    return new Promise((resolve, reject) => {
      const channel = `subagents:rpc:${method}:reply:${requestId}`;
      const off = pi.events.on(channel, (response: any) => {
        clearTimeout(timer); off();
        response.success ? resolve(response.data) : reject(new Error(response.error));
      });
      const timer = setTimeout(() => { off(); reject(new Error('Subagent RPC unavailable/timed out: ' + method)); }, milliseconds);
      pi.events.emit(`subagents:rpc:${method}`, { ...payload, requestId });
    });
  }
  function lookup(id: string) {
    const record = owned.get(id);
    if (!record) throw new Error('Worker not owned by this supervisor');
    return record;
  }
  // Direct Agent calls bypass the contract; expose one controlled start path instead.
  pi.on('tool_call', (event) => {
    if (['Agent', 'SubagentWorkflow'].includes(event.toolName)) return {
      block: true, reason: 'Use start_worker with an explicit bounded contract. Raw delegation bypasses supervision.',
    };
  });
  pi.on('session_start', () => {
    if (watchdog) clearInterval(watchdog);
    watchdog = setInterval(() => { for (const record of owned.values()) tick(record); }, 1000);
    watchdog.unref?.();
  });
  const settled = (e: any) => {
    const record = owned.get(e.id);
    if (!record) return;
    closeRecord(record);
    record.settled = true;
    record.status = e.status ?? 'finished';
  };
  pi.events.on('subagents:completed', settled);
  pi.events.on('subagents:failed', settled);
  pi.on('session_shutdown', () => {
    if (watchdog) clearInterval(watchdog);
    for (const record of owned.values()) { stop(record, 'Controller shutdown'); registry.delete(record.token); }
  });
  pi.registerTool({
    name: 'start_worker', label: 'Start supervised worker',
    description: 'Assign exactly one bounded task. Caller prepares a separate worktree and an exact write allowlist. No automatic commits. Checks are trusted executable/argv pairs, not a sandbox.',
    parameters: object({ task: string, cwd: string, writablePaths: { type: 'array', items: string },
      readOnly: { type: 'boolean' }, checks: { type: 'array', items: object({ id: string,
        executable: string, args: { type: 'array', items: string }, timeoutSeconds: { type: 'integer', minimum: 1, maximum: 600 } }, ['id', 'executable', 'args']) } }, ['task', 'cwd', 'writablePaths']),
    async execute(_id, params: any, _signal, _update, ctx) {
      if (spawnPending) throw new Error('Another supervised start is in progress');
      spawnPending = true;
      try {
      validateProfile(ctx.cwd, !!params.readOnly);
      for (const check of params.checks ?? []) {
        const executable = basename(check.executable);
        const allowed = executable === 'dotnet' ? ['build', 'test'].includes(check.args?.[0]) :
          executable === 'npm' && (check.args?.[0] === 'test' ||
          check.args?.[0] === 'run' && ['build', 'test', 'lint'].includes(check.args?.[1]));
        if (!allowed) throw new Error('Checks may only invoke dotnet build/test or npm build/test/lint; no shell/interpreter commands');
      }
      await rpc('ping');
      if ([...owned.values()].some(r => !r.settled)) throw new Error('Previous worker must actually settle before another start');
      // Validate cwd is a worktree belonging to this repository; refuse its main working tree.
      const root = await pi.exec('git', ['rev-parse', '--show-toplevel'], { cwd: ctx.cwd, timeout: 5000 });
      const listed = await pi.exec('git', ['worktree', 'list', '--porcelain'], { cwd: ctx.cwd, timeout: 5000 });
      if (root.code !== 0 || listed.code !== 0) throw new Error('Controller must run in a Git repository');
      const record = makeRecord({ root: params.cwd, task: params.task, paths: params.writablePaths,
        readOnly: params.readOnly, checks: params.checks }, event => {
        if (event.kind === 'stop-requested') {
          if (record.id) rpc('stop', { agentId: record.id }).catch(() => {});
        }
        pi.sendMessage({ customType: 'worker-supervisor', content: JSON.stringify({ ...event, worker: summary(record) }),
          display: true }, { triggerTurn: event.kind === 'paused' || event.kind === 'stop-requested', deliverAs: 'followUp' });
      });
      const { canonical } = await import('./runtime.mjs');
      const worktrees = listed.stdout.split('\n').filter(l => l.startsWith('worktree ')).map(l => canonical(l.slice(9)));
      if (record.root === canonical(root.stdout.trim()) || !worktrees.includes(record.root)) {
        registry.delete(record.token); throw new Error('Use a separate existing worktree of this repository');
      }
      const controller = new AbortController();
      record.abort = () => controller.abort();
      owned.set(record.token, record);
      try {
        const result = await rpc('spawn', { type: params.readOnly ? 'supervised-reviewer' : 'supervised-worker',
          prompt: `${MARKER}${record.token}\n${record.task}`, options: {
            cwd: record.root, description: record.task.slice(0, 80), isBackground: true,
            inheritContext: false, isolation: 'off', maxTurns: 40, signal: controller.signal,
          } }, 10000);
        record.id = result.id;
        owned.delete(record.token);
        owned.set(record.id, record);
        if (record.stopped) await rpc('stop', { agentId: record.id }).catch(() => {});
        return reply(summary(record));
      } catch (error) { stop(record, 'Spawn failed: ' + String(error)); throw error; }
      } finally { spawnPending = false; }
    },
  });
  pi.registerTool({ name: 'worker_status', label: 'Worker status', description: 'Inspect contract, bounded activity and current diff summary; then inspect changed files before approval.',
    parameters: object({ id: string }, ['id']), async execute(_id, params: any) {
      const record = lookup(params.id);
      const diff = await pi.exec('git', ['diff', '--stat', 'HEAD'], { cwd: record.root, timeout: 5000 });
      const files = await pi.exec('git', ['status', '--short'], { cwd: record.root, timeout: 5000 });
      return reply({ ...summary(record), diff: diff.stdout.slice(-12000), files: files.stdout.slice(-12000) });
    } });
  pi.registerTool({ name: 'continue_worker', label: 'Continue checked worker', description: 'After inspecting actual diff against task, release a paused worker. Does not reset total runtime or tool budget.',
    parameters: object({ id: string, review: string }, ['id', 'review']), async execute(_id, params: any) {
      const record = lookup(params.id); approve(record, params.review); return reply(summary(record));
    } });
  pi.registerTool({ name: 'stop_worker', label: 'Stop worker', description: 'Revoke further tool access and abort via subagent RPC. Acknowledgement is not proof that OS children or blocked I/O have exited.',
    parameters: object({ id: string, reason: string }, ['id']), async execute(_id, params: any) {
      const record = lookup(params.id); stop(record, params.reason); return reply(summary(record));
    } });
}
