---
name: task-planning
description: Convert an approved implementation plan into a tracked task list and work through it step by step. Groups tasks under named Aufgaben so interrupted work can be paused and resumed correctly across sessions. Works with plain markdown files — no external tools or platform dependencies required.
---

# Task Planning Skill

This skill bridges planning and implementation by turning each approved plan step into a tracked task. Tasks are grouped under an **Aufgabe** — a named piece of work (feature, bug, refactor) that carries its own branches and status. This lets you drop a running Aufgabe when an urgent bug hits, work the bug as a separate Aufgabe, and later resume the first one exactly where you left off — even on the correct branch.

Three layers:

- **`.tasks/` folder** in the project root — the persistent source of truth, survives session ends and interruptions. One file per Aufgabe plus an `_index.md` pointer.
- **`.tasks/_index.md`** — names the currently **active** Aufgabe and lists all Aufgaben with their status. This is the entry point on session start.
- **git worktrees** (optional but recommended for parallel work) — each Aufgabe gets its own working directory via `git worktree add`, so multiple Aufgaben can coexist on different branches simultaneously without re-cloning repos.

Status updates are reported as plain text output — no external tracking tool is required.

## Concepts

| Level | What it is | Lives in |
|---|---|---|
| **Aufgabe** | A named piece of work with its own branches and status (`aktiv` / `pausiert` / `erledigt`) | one file `.tasks/<slug>.md` |
| **Batch** | A set of tasks worked through in one uninterrupted run (same file / concern / dependency chain) | `## Batch X` section inside the Aufgabe file |
| **Task** | One independently completable step | `- [ ]` line inside a batch |

Exactly **one** Aufgabe is `aktiv` at a time.

---

## Layout

```
.tasks/
  _index.md              ← active Aufgabe + list of all Aufgaben
  bonding-group.md       ← one file per Aufgabe (slug = kebab-case name)
  hotfix-login-500.md
```

**`_index.md` format:**
```markdown
# Aufgaben-Index
_Last updated: <date>_

**Aktiv:** bonding-group

- [aktiv]    bonding-group — Bonding Group Scheduling (`bonding-group.md`)
- [pausiert] hotfix-login-500 — Login liefert 500 (`hotfix-login-500.md`)
- [erledigt] audit-archive — Audit-Archivierung (`audit-archive.md`)
```

If no Aufgabe is active (all done / paused), write `**Aktiv:** —`.

**Aufgabe file `.tasks/<slug>.md` format:**
```markdown
# Aufgabe: Bonding Group Scheduling
_Status: aktiv · Last updated: <date>_

**Branches:**
- repo-A → `feature/bonding-group`
- repo-B → `feature/bonding-group`

**Gestartet:** <date>

## Batch A — Datenmodell
- [ ] Add QueryConfiguration endpoint (`Controllers/...`)
- [ ] Write unit test for QueryConfiguration

## Batch B — Versioning
- [ ] Bump version in project file
```

- **Branches** lists the branch per repo the Aufgabe is worked on. If none exist yet, write `- noch keine`. Add repos as branches get created.
- Status markers: `[ ]` = open, `[~]` = in progress, `[x]` = done (with completion note below).
- Completed tasks and their notes are **never deleted** — they are the history for future context.

### Recommended worktree layout

```
<worktree-root>/          ← configurable, e.g. ../cases/ or ~/work/cases/
  repos/                  ← Golden Copies: one clone per repo, always on main, never edited directly
    repo-A/
    repo-B/
  cases/                  ← one subdirectory per Aufgabe
    bonding-group/
      repo-A/             → git worktree, branch: feature/bonding-group
      repo-B/             → git worktree, branch: feature/bonding-group
    hotfix-login/
      repo-A/             → git worktree, branch: bugfix/hotfix-login
```

**Golden Copy rule:** `repos/<repo>` is always on `main`. Run `git fetch` there to update all worktrees of the same repo at once (they share the `.git` object store — no re-download).

The project may provide wrapper scripts (e.g. `new-case`, `close-case`) around the git commands below. Use them if available; otherwise use git directly.

---

## Session start: find the active Aufgabe

At the start of every session, before planning anything new:

1. Check if a `.tasks/` folder exists in the project root.
   - **Legacy migration:** if instead a flat `.tasks.md` exists (old format), migrate it: create `.tasks/`, move its content into `.tasks/<slug>.md` as an Aufgabe (infer the name from its `# Tasks — <name>` heading, add a `**Branches:**` block — fill from the repo's current branch if obvious, else `- noch keine`), and create `_index.md` marking it active. Tell the user you migrated.
2. Read `_index.md` to find the **active** Aufgabe, then read that Aufgabe's file **in full** — completed tasks (`[x]`) and their notes give context about what was already done and which decisions were made. Internalize this before doing anything else.
3. **Worktree-Abgleich** (if worktrees are used): run `git worktree list` in each Golden Copy and cross-check with `_index.md`:
   - Worktree exists but no matching Aufgabe → mention it (orphaned worktree?).
   - Aufgabe is `aktiv` or `pausiert` but no worktree exists → offer to create one when resuming (Phase 1).
4. If the active Aufgabe has open tasks (`[ ]` or `[~]`), show them to the user together with its branches and worktree path:
   > "Aktive Aufgabe »Bonding Group« hat noch offene Tasks (Branch `feature/bonding-group`, Worktree: `cases/bonding-group/`) — soll ich weitermachen?"
5. If the user confirms: report the open tasks as a numbered list, then continue from Phase 2.
6. If the user declines, or no Aufgabe is active: list the paused/other Aufgaben from `_index.md` so the user can pick one to resume, or start a fresh Aufgabe (Phase 1).

Before continuing an Aufgabe, verify the worktree exists and you are in it. If the working branch does not match, flag it and ask the user to confirm before switching.

---

## Phase 1: Plan approved → Create Aufgabe + tasks + batches

Immediately after the user approves a plan:

1. **Determine the Aufgabe.** Either this plan extends the active Aufgabe, or it is new work. If new: create `.tasks/<slug>.md` with the header block (status `aktiv`, `**Branches:**`, `**Gestartet:**`), set any previously active Aufgabe to `pausiert` (see Interruptions), and update `_index.md` to point `**Aktiv:**` at the new slug.
2. **Worktree anlegen** (automatisch, ohne extra Bestätigung — gehört zur Aufgabe):
   - Ask which repos are involved if not clear from the plan.
   - For each repo, create a worktree from the Golden Copy:
     ```bash
     # From inside the Golden Copy:
     git fetch origin
     git worktree add ../../cases/<slug>/<repo> -b feature/<slug>
     # or with an existing remote branch:
     git worktree add ../../cases/<slug>/<repo> feature/<slug>
     ```
   - Populate the `**Branches:**` block from the result:
     ```
     **Branches:**
     - repo-A → `feature/<slug>`  (cases/<slug>/repo-A)
     - repo-B → `feature/<slug>`  (cases/<slug>/repo-B)
     ```
   - Tell the user the working directory: `→ Arbeitsverzeichnis: cases/<slug>/`
   - If a worktree for this slug already exists: point it out and ask whether to reuse it.
   - **Constraint:** A branch can only be checked out in one worktree at a time. If the branch is already in use elsewhere, choose a different branch name or remove the other worktree first.
3. Write the batches + tasks into the Aufgabe file (format above).
4. Output a numbered task list per step as plain text — subject line, one-sentence description, file/method scope.
5. Wire strict ordering by noting dependencies as `(nach Task N)` in the description.
6. **Group tasks into logical batches** — present the batch plan to the user before starting any implementation. Example:

   | Batch | Tasks | Begründung |
   |---|---|---|
   | A | 1 + 2 + 3 | Datenmodell — alles hängt von Task 1 ab |
   | B | 4 + 5 | Handler-Erweiterungen — unabhängig voneinander |
   | C | 6 | Tests — erst nach A+B stabil |
   | D | 7 | Hard Gate + Commit |

7. Wait for user confirmation of the batch structure before proceeding.
8. Confirm: "Aufgabe »<Name>« angelegt — N Tasks in M Batches — Worktree: `cases/<slug>/`"

**Granularity rule:** one task per independently completable step. Do not create tasks for:
- Sub-steps that always happen together (e.g., "write function" + "add import" = one task)
- The commit itself — the hard gate is a gate, not a task
- Exploratory steps like "read file X" unless reading is the actual deliverable

---

## Interruptions: switching Aufgabe (automatic, no confirmation)

When the user pulls you off the active Aufgabe mid-work — typically an urgent bug — switch **fully automatically, without asking**:

1. **Pause the current Aufgabe.** In its file set `_Status: pausiert_` and append a resume note directly under the header:
   ```markdown
   **Resume-Hinweis (pausiert am <date>):**
   - Zuletzt: Task „Extend Scheduler" `[~]` — halb fertig, `SchedulerService.cs:288`
   - Branch: repo-A → `feature/bonding-group`
   - Nächster offener Task: „Add unit tests"
   ```
   The note must capture: which task was in progress and its state, the branch(es) to return to, and the next open task. Leave the in-progress task as `[~]`.
2. **Create the new Aufgabe** file `.tasks/<slug>.md` for the interrupting work (status `aktiv`, branches — fill once the branch exists).
3. **Update `_index.md`:** flip the old Aufgabe to `[pausiert]`, add the new one as `[aktiv]`, set `**Aktiv:**` to the new slug.
4. Output the new Aufgabe's task list as plain text, then proceed with Phase 1 for the new Aufgabe.

To **resume** a paused Aufgabe later: set it back to `aktiv` in `_index.md` and its file, read the resume note, verify you are on the recorded branch, output its open tasks, and continue from Phase 2.

---

## Phase 2: Implementation → Status updates + batch summaries

For each task of the active Aufgabe, in order:

1. **Before starting**: update the Aufgabe file (`[ ]` → `[~]`), output: `→ Task N gestartet: <subject>`
2. **Implement** the step.
3. **After finishing**: write a completion note directly below the task, flip `[~]` → `[x]`, bump `Last updated` in the header, output: `✓ Task N erledigt — nächster: Task N+1`

Never batch completions. The Aufgabe file is updated at the same moment as the status output, so an interruption at any point leaves the file in a consistent state.

If you hit a blocker: keep the task as `[~]`, add a `> ⚠ Blocker:` note below it in the Aufgabe file, and add a new task describing what needs to be resolved.

### Batch summary (mandatory after every batch)

After the last task of a batch is marked `[x]`, always present a batch summary before starting the next batch:

```
## Batch A abgeschlossen ✓

| Task | Ergebnis |
|---|---|
| 1 – Add BondedProcessingUnit | `DataTypes/BondedProcessingUnit.cs` neu |
| 2 – Extend GetWrappedInUnitContainer | BONDING-Case in `SchedulerService.cs:275` |
| 3 – Extend ResolveGroups | BONDING wird nicht geflattent (`SchedulerService.cs:267`) |

Nächster Batch B: Handler-Erweiterungen (Tasks 4+5). Soll ich weitermachen?
```

The summary must contain:
- Which files / methods were actually changed (with line numbers if helpful)
- Non-obvious decisions made during implementation
- An explicit prompt asking whether to continue with the next batch

Do not start the next batch until the user gives the go-ahead.

### Completion note format

Append a `>` block directly below the finished task line:

```markdown
- [x] Add QueryConfiguration endpoint (`Controllers/...`)
  > - Added `ConfigurationController.cs:42`, route `GET /api/configuration` → returns `ConfigurationDto`
  > - `IConfigurationService.GetConfiguration()` already existed — no new business logic needed
  > - Response intentionally excludes `internalId` — not part of public API contract (decision with user)
```

**What belongs in the note:**
- Which files / methods were actually touched (with line numbers if helpful)
- Any non-obvious decisions made ("why X instead of Y")
- Surprises or constraints discovered during implementation
- Anything a follow-up session would need to know to continue or modify this work

**What does NOT belong:**
- Restating what the task title already says
- Narrating every edit ("opened file, added line, saved")
- Information already obvious from the code itself

---

## Phase 3: Hard gate before commit

Before running `git commit`, verify:

1. You are on a branch listed in the active Aufgabe's `**Branches:**` block — never commit an Aufgabe's work on another Aufgabe's branch.
2. Read the active Aufgabe file: every task being committed must be `[x]`.
3. If anything is still open, do not commit. Finish or explicitly defer (and note it in the Aufgabe file).

Apply any additional project-specific gates (tests, linting, code review of the diff) as required by your team's workflow.

---

## Phase 4: Aufgabe wrap-up

When all tasks of an Aufgabe are done:
- Mark all entries `[x]` in the Aufgabe file and set `_Status: erledigt_`.
- In `_index.md`, flip the Aufgabe to `[erledigt]`. If it was the active one, set `**Aktiv:**` to the next Aufgabe to resume, or `—` if none.
- **Worktree schließen** — only after the user confirms the PR is merged:
  ```bash
  # From inside each Golden Copy:
  git worktree remove ../../cases/<slug>/<repo>
  # or if the project provides a wrapper script:
  close-case <slug>
  ```
  Branches are kept (for history and PRs). If the PR is still open, leave the worktree in place — only set the Aufgabe status to `erledigt`.
- **Write a wrap-up documentation as a markdown file** (mandatory). Two sections:
  1. **Technisch** — was geändert wurde: betroffene Repos/Branches, Dateien/Methoden (mit Zeilen wo hilfreich), Design-Entscheidungen und ihre Begründung, Tests.
  2. **Fachlich** — was damit erreicht wird: welches fachliche Problem gelöst ist und welchen Nutzen der Anwender davon hat.
  Ablageort: `docs/<slug>.md` im Projektroot (oder nach Projektvorgabe).
- Optionally commit the `.tasks/` files if they are tracked — or leave them as working-tree artifacts.
- Report: "Aufgabe »<Name>« abgeschlossen — alle N Tasks erledigt ✓" + one-line summary + Pfad zur Doku. If a paused Aufgabe remains, offer to resume it.

---

## Quick reference

| Moment | `.tasks/` file | Worktree | Text output |
|---|---|---|---|
| Session start | Read `_index.md` → active Aufgabe file | `git worktree list` abgleichen | — |
| Plan approved | Create/extend Aufgabe file, tasks `[ ]` | `git worktree add` pro Repo → `**Branches:**` befüllen | Numbered task list + Worktree-Pfad |
| Before each step | `[ ]` → `[~]` | arbeite im `cases/<slug>/`-Verzeichnis | `→ Task N gestartet: <subject>` |
| After each step | Completion note, `[~]` → `[x]` | — | `✓ Task N erledigt — nächster: Task N+1` |
| Interrupted by bug | Pause current (+resume note), create new Aufgabe | `git worktree add` für neue Aufgabe | New task list for interrupting work |
| Before commit | on Aufgabe branch? tasks `[x]`? | im richtigen Worktree-Verzeichnis? | Block commit if not satisfied |
| PR gemergt | Aufgabe `erledigt` in file + `_index.md` | `git worktree remove` pro Repo | Summary + Doku-Pfad |
