---
name: spec-to-app
description: |
  Generates a complete, tested, running application from a specification document.
  Uses pi-subagents to split work into small, focused packets — avoids output token limits.
  WORKFLOW: 0) Init Memory → 1) Load spec → 2) Analyze → 3) Plan (task-planning skill) →
  4) Scaffold → 5) Data Layer → 6) API Routes → 7) Pages & Layout → 8) Styling →
  9) Unit Tests → 10) Fix → 11) Code Review → 12) Functional Tests →
  13) Fix → 14) Build Verification → 15) Decision Report.
  NEVER asks what to do. NEVER stops early. Runs to completion.
---

# Spec-to-App Generation Skill

## CRITICAL — Always Execute This First

**At the very first step of every session**, you MUST:

1. **Find the specification file** — check CWD for `GSpendSpec.md`, `GSpendArchitectureSpec.md`,
   or any `*.spec.md` / `*Spec.md` file. If none found, check `.pi/` directory.
2. **If no spec found**, ask the user for it (this is the **only** exception to "no asking").
3. **Read the spec file(s) fully** — parse every section: tech stack, data models, API routes,
   pages, UI conventions, business logic.

## Role

You are a **full-stack development team** (architect + developer + tester + reviewer) that takes
a specification document and produces a complete, tested, running application — **without asking
the user for any implementation decisions**.

## Subagent Strategy (pi-subagents)

**Use `pi-subagents` to avoid output token limits and keep work focused.**

Every phase that produces code MUST be delegated to a subagent with a narrow, well-defined scope.
The orchestrator (you) plans, coordinates, reviews results, and logs decisions.
Subagents implement one unit at a time.

### Subagent Packet Size Rules

- **One subagent = one file or one logical unit** (one route, one component, one test suite).
- Never instruct a subagent to implement more than ~200 lines of code per call.
- If a component is larger, split it: `Header (part 1/2)` → `Header (part 2/2)`.
- After each subagent completes, **verify the output** before proceeding to the next.

### Subagent Call Pattern

```
spawn subagent:
  task: "Implement [specific unit] according to spec section [X]"
  context: [codebase map + relevant spec excerpt + interfaces of related files]
  constraints:
    - Do NOT explore the codebase. No find/grep/ls, no reading files
      to "get a picture of the project".
    - Use ONLY the context provided in this prompt.
    - You may read AT MOST the 1-2 files explicitly listed in the context.
    - If required information is missing, STOP and return a short question
      instead of searching for it.
    - [anti-patterns, naming conventions, max lines]
  output: [exact file path to write]
```

**Why the exploration ban:** Without it, every parallel agent re-reads the same
10-20 files to orient itself — burning 15-25k tokens each and multiplying
runtime. The orchestrator provides all needed context via the Codebase Map
(Phase 2.5); agents implement, they do not investigate.

### When NOT to use subagents

- Reading files (do it directly)
- Running shell commands (bash, npm, pytest)
- Logging decisions
- Writing to `.pi/MEMORY.md` or `.pi/decisions/`

## The Golden Rule: NO QUESTIONS

**NEVER ask the user anything except:**
1. The location of the spec file (if not found).
2. Whether to push to a remote (after everything is done and working).

**If the spec is ambiguous:**
1. Make the most reasonable assumption.
2. Log the decision immediately (see Decision Logging below).
3. Continue implementing.

## Decision Logging

**Every non-trivial implementation decision MUST be logged** to `.pi/decisions/` during the session.
This includes: tech choices, ambiguity resolutions, architecture trade-offs, workarounds for bugs.

### Log Format

```markdown
<!-- .pi/decisions/YYYY-MM-DD_HH-MM_<slug>.md -->
# Decision: <short title>

**Phase:** <phase name>
**File(s) affected:** <path(s)>
**Timestamp:** <YYYY-MM-DD HH:MM>

## What was decided
<one sentence>

## Why
<reasoning — spec reference or trade-off>

## Alternatives considered
- <alt 1> — rejected because <reason>
- <alt 2> — rejected because <reason>

## Improvement potential
- <specific point where this could be revisited>
- <known limitation or tech debt>
```

Log decisions **immediately** when made — not at the end of the session.

## Development Workflow

### Phase 0: Init Memory (first session only)

If `.pi/MEMORY.md` does NOT exist yet, create it and the directory structure:
```
.pi/
  MEMORY.md          ← static project context
  memory/            ← user preferences, feedback
  knowledge/         ← architecture, patterns, bug causes
  decisions/         ← decision log files (one per decision)
```

### Phase 1: Spec Analysis

Read the spec file(s) completely. Extract and organize:
- Tech stack
- Data models and relationships
- API routes and their logic
- Pages, components, modals
- Business rules and edge cases
- UI conventions and locale rules

Write a brief summary to `.pi/MEMORY.md` under "Spec Summary".

### Phase 2: Project Planning

Create implementation plan. Delegate to **task-planning** skill to convert into tracked tasks
(`.tasks/` folder with batches, branches, worktrees). Do not create task lists yourself.

**Memory guidelines:**
- Architecture/patterns/bug causes → `knowledge-base` skill (`.pi/knowledge/`)
- User preferences/feedback → `memory` skill (`.pi/memory/`)
- `.pi/MEMORY.md` → static project context only

### Phase 2.5: Codebase Map (ONE Explore agent — before any implementation)

Spawn exactly ONE Explore agent that surveys the project and writes
`.pi/knowledge/codebase-map.md` (max ~80 lines):

- Directory structure (relevant parts only)
- Existing interfaces/types with signatures (name + params + return, no bodies)
- Conventions observed: naming, error handling, DB access pattern, imports
- Key config values (ports, paths, DB location)

**Every implementation subagent afterwards receives this map in its context.**
This is why they don't need to explore — one agent explored for all of them.

When later phases create files that subsequent agents build on (e.g. the data
layer that API routes import), the orchestrator appends the new file's
interface signatures to the map (direct edit, no subagent) OR includes them
explicitly in the dependent agent's context.

### Phase 3: Project Scaffolding

Implement via subagents, one file per call:
- [ ] Initialize project structure (directories, config files)
- [ ] Set up dependencies (package.json)
- [ ] Create global styles and theme configuration (app.css) — subagent
- [ ] Create tsconfig, vite.config, svelte.config — subagent
- [ ] Install dependencies (npm install) — direct bash

### Phase 4: Data Layer

Each unit via subagent:
- [ ] Database schema (tables, indexes, foreign keys) — subagent
- [ ] Database utilities (connect, query helpers) — subagent
- [ ] Seed default data (categories, config values) — subagent
- [ ] Offline queue (IndexedDB or equivalent) — subagent
- [ ] Integrate DB init into hooks.server.ts — subagent

### Phase 5: API Routes

One subagent per route group:
- [ ] CRUD routes for each resource defined in spec
- [ ] Aggregation routes (carry-over, projections, etc.)
- [ ] Error handling on all routes (try/catch, proper status codes)

### Phase 6: Page Components

One subagent per component:
- [ ] Layout (+layout.svelte, navigation)
- [ ] Dashboard page (state, computed, template, style)
- [ ] Each page component defined in spec
- [ ] All modals and sub-components

### Phase 7: Unit Tests

One subagent per test suite:
- [ ] Tests for database layer
- [ ] Tests for business logic functions
- [ ] Tests for API route handlers
- [ ] Run all unit tests — MUST PASS GREEN
- [ ] Fix any failures (subagent per fix) and re-run

### Phase 8: Code Review

Review one layer at a time:
- [ ] Data layer code
- [ ] API route code
- [ ] Page component code
- [ ] Styles and accessibility
- [ ] Fix issues (subagent per fix)

### Phase 9: Functional Tests

- [ ] Set up functional test environment
- [ ] Test all API endpoints (20+ scenarios per spec)
- [ ] Test page rendering (all pages)
- [ ] Test user interactions (forms, navigation, modals)
- [ ] Test responsive layout
- [ ] Run all functional tests — MUST PASS GREEN
- [ ] Fix failures (subagent per fix) and re-run

### Phase 10: Build Verification

- [ ] npm run build — MUST SUCCEED
- [ ] Dev server starts cleanly
- [ ] No TypeScript compilation errors
- [ ] No linting errors

### Phase 11: Decision Report

**Generate `.pi/decisions/_REPORT.md`** — a structured summary of all decisions made during
this session. This is the final output the user reviews.

```markdown
# Decision Report — <App Name> — <Date>

## Summary
- Total decisions logged: <N>
- Phases completed: <list>
- Build status: ✅ / ❌
- Test status: ✅ / ❌

## Decisions by Phase

### Phase 3: Scaffolding
| # | Decision | Why | Improvement Potential |
|---|----------|-----|-----------------------|
| 1 | ... | ... | ⭐ ... |

### Phase 4: Data Layer
| # | Decision | Why | Improvement Potential |
|---|----------|-----|-----------------------|

[... repeat per phase ...]

## Improvement Hotspots (⭐ = revisit first)

List the top 3–5 decisions with the highest improvement potential, with a brief suggestion
for how to address each in a future iteration.

## Known Tech Debt

List any shortcuts, workarounds, or deferred items with references to the relevant spec section.
```

Present the report path to the user and ask whether to push to remote.

## Spec Interpretation Rules

When the spec is ambiguous, apply these rules **in order**:

1. **Defaults win:** Use defaults specified in the spec (colors, names, categories).
2. **Convention over configuration:** Follow patterns shown in the tech spec.
3. **Consistency:** Same patterns, naming, structure across the codebase.
4. **Fail fast:** Validate early, return 400 with clear error messages.
5. **Graceful degradation:** Show user-friendly errors, don't crash.
6. **German locale:** Use German for UI text, date formats (`DD.MM.YYYY`), number formats (`1.234,56 €`).

Document any assumptions in `.pi/MEMORY.md` under "Spec Interpretations" AND as a decision log.

## Anti-Patterns (forbidden)

- **Asking the user for implementation decisions** — The spec is the source of truth.
- **Stopping early** — Implement everything in the spec, even if simple.
- **Skipping tests** — No untested code. Period.
- **Skipping code review** — Every file must be reviewed.
- **Skipping decision logging** — Every non-trivial decision must be logged immediately.
- **Hardcoding values** — Use constants, config, or spec defaults.
- **Duplicate code** — Extract shared logic into utility functions.
- **Ignoring the spec** — Follow it exactly.
- **Assuming features not in the spec** — Only implement what's specified.
- **Not running the build** — Build failure = app doesn't work.
- **Pushing without permission** — Always ask first.
- **Using old Svelte syntax** — No `$:` reactive declarations, use `$state`/`$derived`/`$effect`.
- **Using `<Link>` component** — Use native `<a>` tags.
- **Using @apply in component `<style>` blocks** — Use plain CSS in components, @apply only in app.css.
- **Using fragile Tailwind responsive utilities** — Use explicit `@media` queries.
- **Putting non-static context in `.pi/MEMORY.md`** — Use `.pi/memory/` or `.pi/knowledge/`.
- **Large subagent packets** — Max ~200 lines per subagent call. Split if larger.
- **Unverified subagent output** — Always read the file a subagent wrote before proceeding.
- **Subagents exploring the codebase** — Implementation agents get their context from the Codebase Map (Phase 2.5), they never grep/find/read around to "understand the project". One Explore agent explores; all others implement.
- **Skipping the Codebase Map** — No implementation subagent may be spawned before `.pi/knowledge/codebase-map.md` exists.

## Session Recovery

If a session is interrupted and resumes:

1. **Read `.tasks/_index.md`** — check which Aufgabe and step was in progress.
2. **Read `.pi/MEMORY.md`** — recover context, decisions, assumptions.
3. **Read `.pi/decisions/`** — review decisions already logged to avoid re-making them.
4. **Continue from the first `[ ]` unchecked step** — never restart.
5. **Verify build still passes** if it was passing before interruption.
6. **Verify tests still pass** if they were passing before interruption.

## Error Recovery

If something fails during generation:

1. **Build fails:** Read error, fix root cause via subagent, re-build.
2. **Tests fail:** Read failing test, diagnose, fix via subagent, re-run.
3. **DB initialization fails:** Check permissions, directory creation.
4. **SSR errors:** Check for `window`/`document` usage at module level.
5. **Infinite loop in code:** Check `$effect` for missing conditions — fix via subagent.
6. **Subagent produces wrong output:** Re-spawn with more specific constraints.
7. **Output token limit hit:** The current response is too large — spawn a subagent for the remaining work instead of continuing inline.

After any fix: **re-run all tests** before proceeding.

## Quality Checklist

Before declaring the system ready, verify ALL of:

- [ ] All spec requirements implemented
- [ ] Build succeeds with zero TypeScript errors
- [ ] Dev server starts on the specified port (default: 5173)
- [ ] Unit tests: 100% pass rate
- [ ] Functional tests: 100% pass rate
- [ ] Code review: clean, no issues
- [ ] No console errors in browser
- [ ] No TypeScript compilation errors
- [ ] No linting errors
- [ ] Responsive design works on mobile (< 48rem) and desktop (>= 48rem)
- [ ] Database initializes correctly on startup (hooks.server.ts)
- [ ] Default/seed data present in database
- [ ] Offline queue functionality works (IndexedDB)
- [ ] Error handling is user-friendly
- [ ] All API routes return proper HTTP status codes
- [ ] All forms have proper validation
- [ ] Navigation uses `<a>` tags, not `<Link>`
- [ ] All decisions logged to `.pi/decisions/`
- [ ] Decision Report generated at `.pi/decisions/_REPORT.md`
