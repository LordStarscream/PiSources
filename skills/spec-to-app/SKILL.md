---
name: spec-to-app
description: |
  Generates a complete, tested, running application from a specification document.
  WORKFLOW: 0) Load spec → 1) Analyze → 2) Plan & Task List (via task-planning skill) → 3) Scaffold →
  4) Data Layer → 5) API Routes → 6) Pages & Layout → 7) Styling →
  8) Unit Tests → 9) Fix → 10) Code Review → 11) Functional Tests →
  12) Fix → 13) Build Verification → 14) Report.
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

## The Golden Rule: NO QUESTS

**NEVER ask the user anything except:**
1. The location of the spec file (if not found).
2. Whether to push to a remote (after everything is done and working).

**NEVER ask about:**
- "Should I use X or Y?" — The spec already says.
- "Do you want feature Z?" — If in spec, implement it.
- "Is this correct?" — Trust the spec.
- "What should I do next?" — Follow the workflow.
- "Can you clarify X?" — Make a reasonable assumption and document it.

**If the spec is ambiguous:**
1. Make the most reasonable assumption.
2. Document the assumption in `.pi/MEMORY.md` under "Spec Interpretations".
3. Continue implementing.

## Development Workflow

### Phase 0: Spec Analysis

Read the spec file(s) completely. Extract and organize all requirements.

### Phase 1: Project Planning

Create a detailed implementation plan based on spec analysis.

After the plan is approved, delegate to the **task-planning** skill to convert it into tracked tasks with batches, branches, and worktrees (`.tasks/` folder). Do not create task lists yourself — use the task-planning skill.

### Phase 2: Project Scaffolding
- [ ] Initialize project structure (directories, config files)
- [ ] Set up dependencies (package.json, imports)
- [ ] Create global styles and theme configuration (app.css)
- [ ] Create tsconfig, vite.config, svelte.config
- [ ] Install dependencies (npm install)

### Phase 3: Data Layer
- [ ] Implement database schema (tables, indexes, foreign keys)
- [ ] Implement database utilities (connect, query helpers)
- [ ] Seed default data (categories, config values)
- [ ] Implement offline queue (IndexedDB or equivalent)
- [ ] Integrate DB init into hooks.server.ts

### Phase 4: API Routes
- [ ] Create CRUD routes for each resource defined in spec
- [ ] Create aggregation routes (carry-over, projections, etc.)
- [ ] Add error handling to all routes (try/catch, proper status codes)

### Phase 5: Page Components
- [ ] Create layout (+layout.svelte, navigation)
- [ ] Implement dashboard page (state, computed, template, style)
- [ ] Implement each page component defined in spec
- [ ] Implement all modals and sub-components

### Phase 6: Unit Tests
- [ ] Write tests for database layer
- [ ] Write tests for business logic functions
- [ ] Write tests for API route handlers
- [ ] Run all unit tests — MUST PASS GREEN
- [ ] Fix any failures and re-run

### Phase 7: Code Review
- [ ] Review all data layer code
- [ ] Review all API route code
- [ ] Review all page component code
- [ ] Review styles and accessibility
- [ ] Fix any issues found

### Phase 8: Functional Tests
- [ ] Set up functional test environment
- [ ] Test all API endpoints (20+ scenarios per spec)
- [ ] Test page rendering (all pages)
- [ ] Test user interactions (forms, navigation, modals)
- [ ] Test responsive layout
- [ ] Run all functional tests — MUST PASS GREEN
- [ ] Fix any failures and re-run

### Phase 9: Build Verification
- [ ] Ensure build succeeds (npm run build)
- [ ] Ensure dev server starts cleanly
- [ ] Verify no TypeScript compilation errors
- [ ] Verify no linting errors

### Phase 10: Final Report
- [ ] Compile readiness report
- [ ] Present to user

Present the plan briefly and start implementing immediately.

## Spec Interpretation Rules

When the spec is ambiguous, apply these rules **in order**:

1. **Defaults win:** Use defaults specified in the spec (colors, names, categories).
2. **Convention over configuration:** Follow patterns shown in the tech spec.
3. **Consistency:** Same patterns, naming, structure across the codebase.
4. **Fail fast:** Validate early, return 400 with clear error messages.
5. **Graceful degradation:** Show user-friendly errors, don't crash.
6. **German locale:** Use German for UI text, date formats (`DD.MM.YYYY`), number formats (`1.234,56 €`).

Document any assumptions in `.pi/MEMORY.md` under "Spec Interpretations".

## Anti-Patterns (forbidden)

- **Asking the user for implementation decisions** — The spec is the source of truth.
- **Stopping early** — Implement everything in the spec, even if simple.
- **Skipping tests** — No untested code. Period.
- **Skipping code review** — Every file must be reviewed.
- **Hardcoding values** — Use constants, config, or spec defaults.
- **Duplicate code** — Extract shared logic into utility functions.
- **Ignoring the spec** — Follow it exactly.
- **Assuming features not in the spec** — Only implement what's specified.
- **Not running the build** — Build failure = app doesn't work.
- **Not documenting assumptions** — Every deviation must be documented.
- **Pushing without permission** — Always ask first.
- **Using old Svelte syntax** — No `$:` reactive declarations, use `$state`/`$derived`/`$effect`.
- **Using `<Link>` component** — Use native `<a>` tags.
- **Using @apply in component `<style>` blocks** — Use plain CSS in components, @apply only in app.css.
- **Using fragile Tailwind responsive utilities** — Use explicit `@media` queries.

## Session Recovery

If a session is interrupted and resumes:

1. **Read the active Aufgabe** from the task-planning skill (`.tasks/_index.md` and the Aufgabe file) — check which step was in progress.
2. **Read `.pi/MEMORY.md`** — Recover context, decisions, assumptions.
3. **Continue from the first `[ ]` unchecked step** in the active Aufgabe — Never restart.
4. **If the build was passing before interruption**, verify it still passes.
5. **If tests were passing**, verify they still pass.
6. **If the dev server was running**, verify it still starts.
7. **If a new spec file was added mid-session**, re-analyze and update the task list via the task-planning skill.

## Error Recovery

If something fails during generation:

1. **Build fails:** Read error, fix root cause, re-build.
2. **Tests fail:** Read failing test, diagnose, fix, re-run.
3. **DB initialization fails:** Check permissions, directory creation.
4. **SSR errors:** Check for `window`/`document` usage at module level.
5. **Infinite loop:** Check `$effect` for infinite re-runs (add conditions).
6. **Stale state:** Ensure `$derived`/`$effect` dependencies are correct.

After any fix: **re-run all tests** before proceeding.

## Quality Checklist

Before declaring the system ready, verify ALL of:

- [ ] All spec requirements implemented
- [ ] Build succeeds with zero TypeScript errors
- [ ] Dev server starts on the specified port (default: 5173)
- [ ] Unit tests: 100% pass rate
- [ ] Functional tests: 100% pass rate
- [ ] Code review: clean, no issues
- [ ] No console errors in browser (check network tab, dev console)
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
