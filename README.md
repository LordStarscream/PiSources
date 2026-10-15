# PiSources

Source of truth for the skills, extensions, and agents running in the local [Pi](https://github.com/pi-dev/pi) coding-agent environment (`~/.pi/agent/`).

## Contents

### Skills

| Skill | Purpose |
|-------|---------|
| `dev-env` | Developer workflow: session recovery, task lists, 7-phase development process (incl. Phase 5.5 Fachlicher Review), git operations, cwd-first search, subagent orchestration |
| `status` | Read-only project status overview — answers "Wo waren wir stehen geblieben?" without starting any work |
| `spec-to-app` | Generates complete tested applications from specification documents (15-phase workflow) |
| `task-planning` | Turns an approved plan into a tracked task list (`.tasks/`), resumable across sessions |
| `memory` | Persistent file-based memory (`.pi/memory/`) — user, feedback, project context, references |
| `knowledge-base` | Project-local knowledge database: lookup ("was weißt du über X") and capture |
| `graphify` | Turns code/docs/papers/images into a persistent knowledge graph (`graphify-out/`): god nodes, community detection, query/path/explain |
| `web-bash` | Lightweight web search & extraction using only bash (DuckDuckGo, StackOverflow, Wikipedia, GitHub raw, markdown fetcher) |

### Extensions

| Extension | Purpose |
|-----------|---------|
| `auto-continue.ts` | Auto-continues a turn that was cut off by the output-token limit (stopReason `length`/`max_tokens`), with a hard cap on consecutive continuations |
| `read-limit.ts` | Caps tool output at the infrastructure level: clamps `read` line limits before execution, truncates `bash` output afterwards — prevents a single turn from ballooning past compaction thresholds |
| `workflow-compaction.ts` | Custom compaction for workflow projects (dev-env/spec-to-app): instead of a generic LLM summary, points at the persisted workflow files (`.tasks/`, `.pi/MEMORY.md`, `.pi/decisions/`, `.pi/knowledge/`) and keeps only essential control info |
| `compaction-metrics.ts` | Passive observer counting/log compactions per reason (`overflow` = balloon caught at turn end, `threshold` = healthy proactive, `manual` = `/compact`), with tokens-before metrics |
| `tokens-per-second.ts` | Real-time tokens/second in the footer during streaming (rolling 3s window, color-coded); subagent-aware via a process-wide shared counter, main session shows the combined total |
| `pi-file-locks/` | Per-agent file locks (`agentId → Set<filePath>`): prevents two subagents from editing the same file concurrently; locks auto-cleaned via subagent lifecycle events |
| `vigil-locks/` | Placeholder for vigil-style locking (currently empty) |
| `core-agent.ts` | Persistent-task harness: injects the first user message as a never-changing TASK into the system prompt, gates tool calls (curl confirmation), truncates tool output, strips large user messages and re-pins the task before each LLM call |
| `safety-guard/` | Blocks dangerous bash commands via tool-call interception (policy-based) |
| `web-search/` | Formal web tools `web_search`, `fetch_url`, `fetch_many` wrapping the web-bash skill's fetcher and DuckDuckGo/StackOverflow/Wikipedia APIs |
| `__init__.py` | Empty marker file (no-op) |

## Current Environment (`~/.pi/agent/`)

Live inventory of what is actually installed and running in the pi environment. PiSources mirrors this directory — after changes here, sync with:

```bash
cp -r skills/<skill> ~/.pi/agent/skills/
cp extensions/<file> ~/.pi/agent/extensions/
```

### Active extensions (`~/.pi/agent/extensions/`)

| Extension | Status | Notes |
|-----------|--------|-------|
| `auto-continue.ts` | ✅ active | debug line for `agent_end` stopReason currently **enabled** |
| `read-limit.ts` | ✅ active | |
| `workflow-compaction.ts` | ✅ active | |
| `compaction-metrics.ts` | ✅ active | |
| `tokens-per-second.ts` | ✅ active | subagent-aware (shared `globalThis` counter) |
| `pi-file-locks/` | ✅ active | |
| `vigil-locks/` | ⚠️ empty dir | no code yet |
| `core-agent.ts` | ✅ active | only relevant for persistent-task runs |
| `__init__.py` | — empty | |
| `safety-guard/` | ❌ not installed | present in this repo, not copied to the live env |
| `web-search/` | ❌ not installed | present in this repo, not copied to the live env |

### Active skills (`~/.pi/agent/skills/`)

All 8 skills from the table above are installed: `dev-env`, `status`, `spec-to-app`, `task-planning`, `memory`, `knowledge-base`, `graphify`, `web-bash`.

### Custom agents (`~/.pi/agent/agents/`)

| Agent | Purpose |
|-------|---------|
| `implementationEngineer` | Implementation subagent (writes code) |
| `unitTestEngineer` | Unit-test subagent |
| `reviewer` | Code-review subagent |
| `worker` | Generic worker subagent |

## Quick Start

### Install

```bash
cd /home/mario/Projects/PiSources
pi install ./
```

### Verify

```bash
pi list  # verify installation
```

### Usage

```bash
pi           # launches agent with skills loaded
/skill:dev-env   # load dev-env skill manually
```

## Architecture

```
PiSources/
├── package.json                    # Pi package manifest
├── extensions/
│   ├── auto-continue.ts            # Continue after output-limit cutoffs
│   ├── read-limit.ts               # Cap tool output (read/bash)
│   ├── workflow-compaction.ts      # Workflow-aware compaction
│   ├── compaction-metrics.ts       # Compaction counting/logging
│   ├── tokens-per-second.ts        # Live TPS footer (subagent-aware)
│   ├── pi-file-locks/              # Per-agent file locks
│   ├── vigil-locks/                # Placeholder (empty)
│   ├── core-agent.ts               # Persistent-task harness
│   ├── safety-guard/               # Dangerous-command blocking (not in live env)
│   └── web-search/                 # Formal web search tools (not in live env)
├── skills/
│   ├── dev-env/                    # Development workflow & behavior
│   ├── status/                     # Read-only status overviews
│   ├── spec-to-app/                # Spec-driven app generation
│   ├── task-planning/              # Tracked task lists (.tasks/)
│   ├── memory/                     # Persistent file-based memory
│   ├── knowledge-base/             # Project knowledge capture/lookup
│   ├── graphify/                   # Codebase knowledge graphs
│   └── web-bash/                   # Bash web command patterns
├── docs/                           # Derived documentation
└── .pi/                            # Session state (gitignored)
    └── MEMORY.md                   # Project context & decisions
```

## Skill Responsibilities

- **dev-env**: "Wie arbeite ich?" — Session recovery, task management, 7-phase workflow (incl. fachlicher Review), search strategy
- **status**: "Wo stehen wir?" — read-only overview, never starts work
- **spec-to-app**: "Wie generiere ich eine App aus einer Spec?" — Full-stack spec-driven development
- **task-planning / memory / knowledge-base**: persistent state — tasks, memory, captured knowledge
- **graphify**: "Was ist die Architektur?" — query the knowledge graph first when `graphify-out/` exists
- **web-bash**: "Wie suche ich im Web?" — Bash one-liners for quick lookups

## Installation Paths

| Purpose | Location |
|---------|----------|
| Project source of truth | `PiSources/skills/`, `PiSources/extensions/` |
| Global (system-wide, live env) | `~/.pi/agent/skills/`, `~/.pi/agent/extensions/` |
| Local test copy | `PiSources/.pi/skills/`, `PiSources/.pi/extensions/` |

Copy skills to global or local test dirs for testing:
```bash
cp -r skills .pi/
```

## License

Private — owned by [LordStarscream](https://github.com/LordStarscream)
