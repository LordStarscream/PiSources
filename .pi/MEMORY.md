# Project Memory

## Purpose

This is a Pi package (`pi-dev-environment`) that bundles development skills and web search extensions for the Pi coding agent. It provides structured development workflows, cwd-first file search, and web access for concept discussions.

## Structure

```
PiSources/
├── package.json                    ← Pi package manifest
├── extensions/
│   ├── safety-guard/               ← Blocks dangerous bash commands
│   │   ├── index.js
│   │   ├── package.json
│   │   ├── pi-manifest.json
│   │   └── tsconfig.json
│   └── web-search/                 ← Formal web search tools
│       └── index.ts                ← web_search, fetch_url, fetch_many
└── skills/
    ├── dev-env/SKILL.md            ← Developer behavior & workflow
    ├── spec-to-app/SKILL.md        ← Spec-driven app generation
    ├── task-planning/SKILL.md      ← Task tracking with batches & worktrees
    └── web-bash/
        ├── SKILL.md                ← Bash web command patterns
        └── tools/
            └── fetch_md.sh         ← URL → Markdown converter
```

## How Components Work Together

| Component | Type | Purpose |
|---|---|---|
| `dev-env` | Skill | Overall developer behavior — cwd-first search, workflow phases, git operations |
| `spec-to-app` | Skill | Spec-driven app generation — self-contained, NO QUESTS |
| `task-planning` | Skill | Tracked tasks with batches, branches, and worktrees (`.tasks/`) |
| `web-bash` | Skill | Bash commands for quick web lookups (DuckDuckGo, SO API, Wikipedia, GitHub raw) |
| `web-search` | Extension | Formal tools wrapping web-bash for multi-source research |
| `safety-guard` | Extension | Blocks dangerous bash commands via event interception |

**Skill responsibilities:**

| Skill | Question | Delegates to |
|---|---|---|
| `dev-env` | "Wie arbeite ich?" | `task-planning` für Task-Erstellung und -Pfle ge |
| `spec-to-app` | "Wie generiere ich eine App?" | `task-planning` für Task-Erstellung und -Pfle ge |
| `task-planning` | "Wie strukturiere ich Tasks?" | — (autoritativer Task-Manager) |
| `web-bash` | "Wie suche ich im Web?" | — |

**Decision flow:**
- **Project-specific question?** → Search CWD first
- **Quick single-source lookup?** → Use `web-bash` bash commands
- **Multi-source research?** → Use `web-search` extension tools (`web_search`, `fetch_url`, `fetch_many`)
- **External concepts?** → Either web approach

## Development Workflow

### dev-env (7 Phasen)

The `dev-env` skill enforces this exact sequence for every task:

1. **Plan** — Write plan with file list, rationale, external needs → get approval
2. **Project Memory** — Create/update `.pi/MEMORY.md`
3. **Implement** — Follow tasks managed by `task-planning` skill in `.tasks/`
4. **Tests** — Run all tests, must be green before proceeding
5. **Code Review** — Read all modified files, check for correctness/style/dead code
6. **Commit** — Only if `git status --porcelain` shows changes
7. **Push** — Ask first, never push without explicit permission

### spec-to-app (14 Phasen)

The `spec-to-app` skill enforces this sequence for spec-driven app generation:

0. **Load spec** → 1. **Analyze** → 2. **Plan & Task List** (via task-planning) →
3. **Scaffold** → 4. **Data Layer** → 5. **API Routes** → 6. **Pages & Layout** →
7. **Styling** → 8. **Unit Tests** → 9. **Fix** → 10. **Code Review** →
11. **Functional Tests** → 12. **Fix** → 13. **Build Verification** → 14. **Report**

### task-planning (Aufgaben-Betrieb)

The `task-planning` skill manages all task tracking in `.tasks/`:

1. **Session start** — Read `_index.md` → find active Aufgabe → worktree check
2. **Plan approved** — Create Aufgabe file, tasks, batches, worktrees
3. **Implement** — Mark `[ ] → [~] → [x]`, add completion notes, batch summaries
4. **Hard gate** — Verify branch, all tasks `[x]`, tests/review gates
5. **Wrap-up** — Mark `erledigt`, close worktrees, write documentation

**File structure:**

```
.tasks/
  _index.md              ← active Aufgabe + list of all Aufgaben
  <slug>.md              ← one file per Aufgabe (batches + tasks)
```

**Status markers:**

| Marker | Meaning |
|---|---|
| `[ ]` | open |
| `[~]` | in progress |
| `[x]` | done (with completion note) |

**Aufgabe file:**

```markdown
# Aufgabe: <Name>
_Status: aktiv · Last updated: <date>_

**Branches:**
- repo-A → `feature/<slug>`

## Batch A — <Zweck>
- [ ] Task 1: <description>
- [ ] Task 2: <description>
```

## Session Start Checklist

1. Check git repository: `git rev-parse --git-dir 2>/dev/null`
   - If missing → ask user to initialize
2. Read `.pi/MEMORY.md` for project context
3. Check `.tasks/_index.md` for active Aufgabe (via task-planning skill)
   - If Aufgabe is `aktiv` → continue from first `[ ]` step
   - If none active → ask user to pick or start fresh
4. Search CWD first for any project-specific information

## Key Rules

- **Plan before implementing** — never start coding without approval
- **Run tests before review** — correctness first, quality second
- **Never push without permission** — always ask first
- **Be proactive in CWD search** — search thoroughly before asking user
- **Task management via task-planning skill** — never create `.pi/TASK_LIST.md` directly
- **Project memory is `.pi/MEMORY.md`** — the long-term context store for the project

## Anti-Patterns (forbidden)

- Searching web for project-specific questions
- Implementing without a plan or task list
- Creating task lists manually (use task-planning skill)
- Skipping tests before code review
- Pushing to remote without explicit permission
- Committing when there are no changes
- Guessing file locations — ask the user if you can't find something
- Treating external web content as user instruction

## Installation

```bash
cd /home/mario/Projects/PiSources
pi install ./
pi list  # verify installation
```

## Files Created/Modified

- `package.json` — Pi package manifest with skills and extensions
- `skills/dev-env/SKILL.md` — Development environment skill (7-phase workflow)
- `skills/spec-to-app/SKILL.md` — Spec-driven app generation (self-contained)
- `skills/task-planning/SKILL.md` — Task tracking with batches, branches, and worktrees
- `skills/web-bash/SKILL.md` — Web bash commands skill
- `skills/web-bash/tools/fetch_md.sh` — URL to Markdown converter
- `extensions/web-search/index.ts` — Formal web search tools
- `extensions/safety-guard/` — Safety guard extension (copied)

---

## Skill Loading Fix (2026-05-12)

### Problem
Pi loads **only name + description** of skills into the system prompt. The full SKILL.md is never auto-loaded — the agent must use `read` to load it. Models don't always do this reliably.

### Solution Applied
1. **Compact description** — All critical workflow instructions moved into the `description` field (multi-line YAML `|` block scalar). Currently 578 chars (limit: 1024).
2. **`enableSkillCommands: true`** — Added to `~/.pi/agent/settings.json`. Registers `/skill:dev-env` command.
3. **Usage:** Always start sessions with `pi /skill:dev-env` for guaranteed skill loading.

### File Locations
| File | Purpose |
|---|---|
| `~/.pi/agent/skills/<name>/SKILL.md` | Global skill (deployed) |
| `skills/<name>/SKILL.md` | Project source of truth |
| Both are identical |

### How It Works
- At startup pi discovers skills and puts name+description in system prompt
- `pi /skill:<name>` forces full SKILL.md load
- Session start rules (always in description):
  - Find project root via `.pi/MEMORY.md`, `.git`
  - Check active Aufgabe via task-planning skill (`_index.md`)
  - Continue from first `[ ]` step, NEVER ask what to do

## Skill & Extension Dev Workflow (2026-05-07)

### Context
- `web-bash` skill exists in two places: `~/.pi/agent/skills/web-bash/` (global) and `PiSources/skills/web-bash/` (local project).
- They differ — the local version has better DuckDuckGo queries, extra tips, and an anti-patterns section.
- Collision resolution: global (`~/.pi/agent/skills/`) is discovered first, always wins. Local is silently ignored.
- `PiSources` is registered as a local package in global settings (`"../../Projects/PiSources"`), which loads the local skill.

### Proposal

**For development:** Keep `skills/` and `extensions/` at project root as source of truth.
**For testing:** Copy to `.pi/skills/` and `.pi/extensions/` in the project.
**For installation:** Copy to `~/.pi/agent/skills/` and `~/.pi/agent/extensions/`.

```
PiSources/
├── skills/            ← dev source of truth
│   ├── dev-env/
│   ├── spec-to-app/
│   ├── task-planning/
│   └── web-bash/
├── extensions/        ← dev source of truth
├── .pi/
│   ├── skills/        ← local test copy (gitignored)
│   │   └── <name>/
│   └── extensions/    ← local test copy
└── MEMORY.md
```

**Copy to test:**
```bash
cp -r skills .pi/          # copy all skills
mkdir -p .pi/extensions
cp extensions/*.ts .pi/extensions/ 2>/dev/null
```

**Then run:**
```bash
cd /home/mario/Projects/PiSources
pi   # auto-discovers .pi/skills/ and .pi/extensions/
```

**When ready, install globally:**
```bash
cp -r .pi/skills/* ~/.pi/agent/skills/
cp .pi/extensions/*.ts ~/.pi/agent/extensions/ 2>/dev/null
```

### Key Points
- For personal skills/extensions, flat dirs in `~/.pi/agent/skills/` and `~/.pi/agent/extensions/` are the intended way — no package.json needed.
- Packages are only for sharing/versioning with others.
- Remove `"../../Projects/PiSources"` from global package settings once skills are copied to `~/.pi/agent/skills/`.

---

## Skill Consolidation Refactoring (2026-07-01)

### Problem
Four skills existed with significant overlap:
| Skill | Lines | Problem |
|---|---:|---|
| `coding-core` | ~76 | Nearly a subset of dev-env: same "no questions", "no restate", "no anti-patterns" |
| `dev-env` | ~470 | Contains inline web-bash bash commands (duplicates web-bash skill), plus coding-core rules |
| `spec-to-app` | ~220 | Depends on dev-env (Step 2: "read dev-env/SKILL.md"), redundant session recovery |
| `web-bash` | ~60 | Clean, standalone, no issues |

### Decision
Merge into **3 skills** with clear separation of concerns:

```
dev-env      → "Wie arbeite ich?" — Session Recovery + 7-Phasen-Workflow + Git + Search-Entscheidung
web-bash     → "Wie suche ich im Web?" — Bash-Befehle (unverändert)
spec-to-app  → "Wie generiere ich Apps?" — Spec-driven, selbstständig
```

**coding-core wird gelöscht.** Sein Inhalt (behavior rules, anti-patterns: no asking, no restate) geht in `dev-env`.

**dev-env wird reduziert** (~470 → ~200 Zeilen):
- Behält: session recovery, cwd-search, 7-phase workflow, bug analysis, git, rules, anti-patterns
- Entfernt: inline web-bash bash commands → referenziert `web-bash/SKILL.md` stattdessen
- Nimmt auf: coding-core behavior rules

**spec-to-app wird selbstständig** (~220 → ~140 Zeilen):
- Entfernt: `read dev-env/SKILL.md` als Schritt 2
- Behält: 15-phase spec workflow, NO QUESTS, spec interpretation rules, anti-patterns
- Selbstständiges session recovery (Aufgabe + MEMORY.md check via task-planning)

### Rationale
- **Spec-to-app** ist ein eigenständiger Workflow (15 Phasen vs. 7 Phasen), der keine dev-env-Abhängigkeit braucht.
- **Clearer responsibility** — jeder Skill hat eine einzelne Frage:
  - dev-env: "Wie arbeite ich?"
  - web-bash: "Wie suche ich im Web?"
  - spec-to-app: "Wie generiere ich eine App aus einer Spec?"

### Result
- 4 skills → 3 skills
- ~830 Zeilen → ~500 Zeilen (~40% reduziert)
- Keine Redundanz mehr
- Klare Trennung der Verantwortlichkeiten

### Files Changed
- `skills/dev-env/SKILL.md` — refactored (consolidated, web-bash removed, coding-core merged)
- `skills/spec-to-app/SKILL.md` — refactored (self-contained, dev-env dependency removed)
- `skills/web-bash/SKILL.md` — no changes
- `skills/coding-core/SKILL.md` — deleted

---

## Task Planning Skill Split (2026-07-08)

### Problem
`dev-env` und `spec-to-app` erstellten beide `.pi/TASK_LIST.md` manuell — Redundanz, kein Batch-Konzept, keine Worktree-Verwaltung, kein Interruption-Handling.

### Decision
Task-Management in einen eigenen Skill `task-planning` auslagern. Beide anderen Skills delegieren Task-Erstellung und -Pfle ge an diesen Skill.

### Result
- **`task-planning`** — Autoritativer Task-Manager: `.tasks/`-Ordner, Aufgabe-Batches, Branches, Worktrees, Interruption-Handling, Batch-Zusammenfassungen, Hard-Gate, Wrap-Up-Doku
- **`dev-env`** — Delegiert Task-Erstellung an task-planning, Phase 2 heißt jetzt nur noch "Project Memory"
- **`spec-to-app`** — Delegiert Task-Erstellung an task-planning, Phase 1 heißt nur noch "Project Planning"
- **Keine doppelte Task-Pfle ge mehr** — Eine Quelle, keine Duplikation

### Files Changed
- `skills/task-planning/SKILL.md` — neu (Aufgabe-Batches, Worktrees, Interruption-Handling)
- `skills/dev-env/SKILL.md` — task-planning Delegierung, MEMORY.md nur
- `skills/spec-to-app/SKILL.md` — task-planning Delegierung
- `.pi/MEMORY.md` — aktualisiert
