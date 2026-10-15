# Supervised workers

PiSources now supplies a controller extension (`worker-supervisor`) and a worker
extension (`worker-guard`). The controller starts one bounded task at a time via
pi-subagents 0.22.0 RPC. The worker receives only the guard, no general workflow
skills, no shell, and no nested agents. New profile names avoid replacing a local
`implementationEngineer` or `reviewer` without review.

## Prerequisites and installation

Target: modern Pi (`@earendil-works/pi-coding-agent` >=1.1.0), Node >=22.19,
`@tintinweb/pi-subagents` 0.22.0. This change does not install or upgrade Pi,
models, providers, or the third-party subagent package.

Use ONE installation route. Do not load copies of the same extension both through
a package and the global extensions directory.

### Existing manually copied installation

From the checked-out PiSources branch, with Pi stopped:

```bash
mkdir -p ~/.pi/agent/extensions ~/.pi/agent/agents
cp -R extensions/worker-supervisor extensions/worker-guard ~/.pi/agent/extensions/
cp extensions/core-agent.ts extensions/auto-continue.ts extensions/workflow-compaction.ts ~/.pi/agent/extensions/
cp docs/agents/supervised-worker.md docs/agents/supervised-reviewer.md ~/.pi/agent/agents/
```

Back up existing local files before copying. Review and sync the updated
`skills/dev-env`, `skills/spec-to-app`, and `skills/task-planning` directories too.
If a legacy root-level extension copy was installed, sync the canonical
`extensions/` implementation instead of installing the repository-root shim alone.

### Package installation

After reviewing/checking out this branch, install the local package with
`pi install /absolute/path/to/PiSources`. Its manifest declares both extensions
and `docs/agents/` as package agents. Project/global agent definitions take
precedence over package profiles; an unsafe shadowing supervised profile is
rejected before spawning. For nonstandard user-selected package configurations,
confirm the profiles actually appear in `/agents` before use.

Merge the settings in `config/subagents.example.json` into
`~/.pi/agent/subagents.json` or the project's `.pi/subagents.json`.
Do not overwrite an existing configuration wholesale. In particular use
`fallbackSubagent: "none"` so a missing custom type cannot silently run a generic
agent. A fresh Pi session is recommended after syncing. `/agents` must list the
two supervised profiles and the model must see `start_worker`, `worker_status`,
`continue_worker`, and `stop_worker`.

## Start a bounded task

The controlling session prepares a separate worktree of the same repository:

```bash
git worktree add ../lario-worker-t2 -b worker/t2 HEAD
```

Do not use pi-subagents' automatic `isolation: worktree` for these profiles:
that feature auto-commits on cleanup. The new profiles force `isolation: off`,
while `start_worker` verifies that the supplied cwd is another listed worktree
of the controller's repository. Worktrees start at committed HEAD; outstanding
changes in the controller tree are NOT copied. Explicitly arrange any required
base state before dispatching. Never remove a worktree with unreviewed changes.

Example tool arguments for the controller (not a slash command):

```json
{
  "task": "Only T2: implement the assigned master-data API and its integration tests. T3 and later tasks, frontend, task files and commits are excluded. Report blockers and stop when done.",
  "cwd": "/home/mario/Projects/lario-worker-t2",
  "writablePaths": ["src/Lario.Host/Api/MasterData.cs", "tests/Lario.Api.Tests/MasterDataTests.cs"],
  "checks": [
    {
      "id": "api-tests",
      "executable": "/home/mario/.dotnet/dotnet",
      "args": ["test", "tests/Lario.Api.Tests", "--filter", "FullyQualifiedName~MasterData"],
      "timeoutSeconds": 300
    }
  ]
}
```

Replace example paths with actual existing paths. Exact files are preferred;
an allowlist entry ending in `/` grants that directory recursively. The entire
project root cannot be writable. `.git`, `.pi`, and `.tasks` are protected.
Read access is bounded to the assigned worktree too. The main session supplies
required snippets rather than letting workers search the host filesystem.

Checks run with `shell: false`, fixed argv, closed stdin, bounded output and an
individual timeout. The worker supplies only a check ID, never a command.
The controller can authorize only `dotnet build/test`, `npm test`, or
`npm run build/test/lint`. Review project scripts, test code, hooks and argument
paths before authorizing them. They remain trusted executable code and can write
outside the allowlist: this is capability restriction, NOT an OS sandbox. Do not
authorize dev servers, watchers, shell wrappers, installs, or Git operations.
No checks is a valid choice; the main session may perform validation itself.

`readOnly: true` selects the separate supervised-reviewer profile. It has only
read/search tools and cannot call `worker_check`; pass an empty checks array.
Ordinary `Agent` and `SubagentWorkflow` tool calls are blocked while the controller
extension is active, so the model cannot accidentally bypass the managed start
path. Human UI mentions or other trusted extensions are outside this tool gate;
do not start unmanaged implementation agents there.

## Budgets and checkpoints

- 40 agent turns (plus the configured grace turns in pi-subagents).
- 80 total tool calls, 20 minutes wall-clock per contract.
- A checkpoint after 10 calls or five minutes. The guard serializes actual tool execution
  and pauses BEFORE the next execution. Preflight `tool_call` hooks never wait
  for tool results: Pi can prepare an entire parallel batch before running it. Until then status is `pause-requested`, not
  proof of a quiescent snapshot. A model request may still be in flight.
- Read/search/edit tools have a 30-second watchdog. Assigned checks have their
  own timeout, at most 600 seconds, with at most two executions per check ID.
- Budget state is in a process-shared registry, not model context; neither
  compaction nor `continue_worker` resets cumulative limits. A completed/stopped
  contract cannot be reused by resume. After restarting Pi, create a new contract.

Blocking `get_subagent_result(wait: true)` calls are rejected by the controller
extension. They can prevent the parent from responding to a paused worker.
Use notifications, `worker_status`, or a nonblocking result query instead.

At a `paused` notification, the controller calls `worker_status`, then inspects
the actual diff and untracked files against the task. The displayed recent
activity is a bounded audit, not a substitute for a complete diff. Call
`continue_worker` with `id` and a concrete `review` rationale, or `stop_worker`.
The latter revokes further tool access before aborting the model/RPC and the
approved check's process group. Checkpoints do not automatically approve
themselves. If the parent model cannot respond, the wall-clock cap still fires.

The supervisor holds actionable notifications locally until the controller is idle
and has no queued messages (checked once per second). It sends only a live `paused`
or autonomous `stop-requested` event, identified by worker ID/token and a per-worker
sequence number. Review/continue, explicit controller stop and terminal lifecycle
events discard obsolete pending notifications. `checkpoint-requested` is an internal
transition, not an extra LLM message; an explicit `stop_worker` does not wake its own
controller again. Budget enforcement and stop RPCs still run immediately while the
controller is busy. Other extensions' notifications are unaffected.

No automatic budget extension: split remaining work into a newly reviewed task.
Neither worker nor reviewer creates commits. The controller reviews, runs the
required checks, and explicitly stages accepted files. Use an explicit reviewed
patch/copy to transfer new and changed files from the worker worktree; do not
use an automatic worktree cleanup that creates commits or deletes pending work.

## Cancellation and limitations

`stop_worker` means cancellation requested and capabilities revoked, not proof
that every OS operation ended. Observe the terminal event and check processes.
Linux uninterruptible `D` state, native code blocking Node's event loop, malicious
approved scripts, and tools ignoring AbortSignal cannot be fixed by a JS timer.
Use an OS process/container supervisor for hard isolation against those cases.
The native manual fallback is `/agents` -> open worker -> `x`, then `x` again.
Esc in the parent is not a universal background-worker stop.

The supervisor controls top-level agents it owns via RPC. Workflow-owned/nested
agents are deliberately not supervised; use neither for this initial managed
workflow. There is no automatic OpenAI review/fix loop in this change.

## Verification before unattended use

`npm ci --ignore-scripts` installs the pinned Pi SDK locally; then `npm test`
exercises policy, symlink escapes, cancellation/checkpoints, actual short-lived
processes, and the RPC adapter with a mocked Pi event bus. Two regression tests
use the real Pi agent loop in parallel mode with a deterministic, local fake
model response containing twelve read calls: continuation and cancellation at
the tenth completed execution must both work. No LLM or API key is needed. It does
not establish end-to-end compatibility with a live local Pi/LLM installation.

In a disposable worktree first verify: one allowed edit, one denied edit outside
scope, checkpoint/continuation, stopping a worker, and absence of new commits.
Check a normal completion stays successful rather than being marked cancelled.
Then use one small real task; review its diff before increasing autonomy.

## Why the older harness changed

`core-agent.ts` is now a no-op compatibility file: immutable first-task injection
conflicted with steering and status questions. Workflow compaction no longer
authorizes the first unchecked task; supervised workers do not load that extension
at all. Auto-continuation recognizes the supervised worker marker as a second
defence, but worker profiles load only the guard. Existing `pi-file-locks` and
`safety-guard` extensions are not relied on as security boundaries.


## Batch scheduling correction

The first guard version acquired its execution lock in `tool_call` and released
it in `tool_result`. That deadlocked a parallel batch: Pi first prepares all
calls, and only then starts executing them. The active-tool watchdog correctly
cancelled the resulting stall, but the stall itself was a guard defect.

Admission, queueing, budgets and checkpoints now live in native-tool execution
wrappers and release in `finally`, without waiting for result-delivery events.
The hook performs only immediate policy checks. Parallel requests remain valid;
the worker is not required to coax the model into emitting one tool per turn.
The audit's executed-call count can differ from Pi's attempted-call count.
