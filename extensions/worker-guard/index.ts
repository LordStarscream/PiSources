import { type ExtensionAPI, createReadToolDefinition, createWriteToolDefinition, createEditToolDefinition,
  createGrepToolDefinition, createFindToolDefinition, createLsToolDefinition } from '@earendil-works/pi-coding-agent';
import { spawn } from 'node:child_process';
import { registry, permit, beforeTool, finishTool, stop, closeRecord, tick, terminate } from '../worker-supervisor/runtime.mjs';

export default function (pi: ExtensionAPI) {
  let record: any;
  let requiresContract = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  pi.on('before_agent_start', (event, ctx) => {
    requiresContract = event.systemPrompt.includes('PISOURCES_SUPERVISED_WORKER');
    const token = event.prompt.match(/PISOURCES_WORKER_CONTRACT=([a-f0-9-]+)/)?.[1];
    if (!record && !token) return;
    if (!record) {
      record = registry.get(token);
      if (!record || record.attached) throw new Error('Missing or already bound supervisor contract');
      record.attached = true;
      record.status = record.stopped ? 'stop-requested' : 'running';
      const parentAbort = record.abort;
      record.abort = () => { parentAbort?.(); ctx.abort(); };
      timer = setInterval(() => tick(record), 1000);
      timer.unref?.();
    }
    return { systemPrompt: event.systemPrompt + '\n\nAssigned task only:\n' + record.task +
      '\nWritable paths: ' + JSON.stringify(record.paths) +
      '\nNo commits, task/control-file changes, delegation, shell, or follow-up tasks. Stop when done.\n' +
      'Available check IDs: ' + record.checks.map((c: any) => c.id).join(', ') };
  });
  // Pi may prepare a whole batch before it executes ANY tool. Never wait here.
  pi.on('tool_call', (event) => {
    if (!record) return requiresContract ? { block: true, reason: 'Missing supervisor contract' } : undefined;
    try { permit(record, event.toolName, event.input); }
    catch (error) {
      stop(record, String(error));
      return { block: true, reason: String(error) };
    }
  });
  async function executeGuarded(name: string, params: any, signal: AbortSignal | undefined, execute: () => Promise<any>) {
    if (!record) {
      if (requiresContract) throw new Error('Missing supervisor contract');
      return execute(); // Main-session native tools retain ordinary behavior.
    }
    const current = record;
    let acquired = false;
    const abort = () => stop(current, 'Tool execution cancelled');
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    try {
      await beforeTool(current, name, params);
      acquired = true;
      return await execute();
    } catch (error) {
      // Tool failures are reported for the bounded repair loop; policy/budget
      // failures already revoke the contract in preflight or beforeTool.
      if (!acquired && !current.stopped) stop(current, String(error));
      throw error;
    } finally {
      signal?.removeEventListener('abort', abort);
      if (acquired) finishTool(current);
    }
  }
  for (const factory of [createReadToolDefinition, createWriteToolDefinition, createEditToolDefinition,
    createGrepToolDefinition, createFindToolDefinition, createLsToolDefinition]) {
    const native = factory(process.cwd());
    pi.registerTool({ ...native,
      async execute(id: string, params: any, signal: AbortSignal | undefined, update: any, ctx: any) {
        const input = { ...params };
        if (record && ['grep', 'find'].includes(native.name)) input.limit = Math.min(Number(input.limit) || 100, 100);
        return executeGuarded(native.name, input, signal, () => native.execute(id, input, signal, update, ctx));
      },
    } as any);
  }
  pi.on('agent_end', () => {
    if (!record) return;
    // The contract cannot be reused by a background continuation or a resume.
    closeRecord(record);
    if (timer) clearInterval(timer);
  });
  pi.on('session_shutdown', () => {
    if (timer) clearInterval(timer);
    if (record) stop(record, 'Session shutdown');
  });
  pi.registerTool({
    name: 'worker_check', label: 'Assigned worker check',
    description: 'Run only a controller-approved check ID. No shell or custom arguments. At most two attempts per ID.',
    parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false } as any,
    async execute(_id, params: any, signal) {
      return executeGuarded('worker_check', params, signal, async () => {
      if (!record || record.stopped) throw new Error('No live worker contract');
      const check = record.checks.find((c: any) => c.id === params.id);
      if (!check) throw new Error('Unknown check ID');
      const attempts = record.checksRun.get(check.id) ?? 0;
      if (attempts >= 2) throw new Error('Check attempt budget exhausted; report blocker');
      record.checksRun.set(check.id, attempts + 1);
      const result = await new Promise<any>((resolve, reject) => {
        const child = spawn(check.executable, check.args, { cwd: record.root, shell: false,
          detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
        record.processes.add(child);
        let output = '', timedOut = false;
        const append = (chunk: Buffer) => { output = (output + chunk.toString()).slice(-16000); };
        child.stdout.on('data', append); child.stderr.on('data', append);
        const abort = () => terminate(child);
        signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted) abort();
        const timeout = setTimeout(() => { timedOut = true; abort(); }, check.timeoutSeconds * 1000);
        const cleanup = () => {
          clearTimeout(timeout); signal?.removeEventListener('abort', abort); record.processes.delete(child);
        };
        child.once('error', error => { cleanup(); reject(error); });
        // exit rather than close: inherited output pipes must not hang the result.
        child.once('exit', (code, exitSignal) => {
          terminate(child); cleanup(); resolve({ code, signal: exitSignal, timedOut, output });
        });
      });
      return { content: [{ type: 'text', text: JSON.stringify(result) }], details: result,
        isError: result.timedOut || result.code !== 0 };
      });
    },
  });
}
