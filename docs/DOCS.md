# PiSources — Vollständige Dokumentation

Dieses Paket enthält alle **Skills**, **Extensions** und **Agent-Definitionen** für den Pi-Coding-Agent.

## Quick Reference

### Skills (6)

| Skill | Beschreibung | Typ |
|---|---|---|
| `dev-env` | Haupt-Workflow: Projekt-Discovery → Plan → Implement → Commit → Push | Orchestrator |
| `spec-to-app` | Autonomer Fullstack-Workflow: Spec → lauffähige App | Spec-getrieben |
| `task-planning` | Autoritativer Task-Manager: Aufgabe → Batch → Task | Task-Management |
| `memory` | Typed, dateibasiertes Gedächtnis (user, feedback, project, reference) | Persistent Memory |
| `knowledge-base` | Suchbare Wissensdatenbank (Architektur, Patterns, Bugs, Entscheidungen) | Knowledge Base |
| `web-bash` | Lightweight Web-Suche via Bash (DuckDuckGo, SO, Wikipedia, GitHub) | Utility |

### Extensions (10)

| Extension | Datei | Beschreibung |
|---|---|---|
| `auto-continue` | `auto-continue.ts` | Automatisches Fortsetzen bei Output-Token-Limit |
| `compaction-metrics` | `compaction-metrics.ts` | Passiver Beobachter: Compaction-Zähler + Log |
| `core-agent` | `core-agent.ts` | SystemPrompt- + Task-Injection für jede Session |
| `pi-file-locks` | `pi-file-locks/` | Datei-Sperren für Subagenten (prevent concurrent edits) |
| `read-limit` | `read-limit.ts` | Kapt Tool-Output auf Infrastruktur-Ebene (read/bash) |
| `safety-guard` | `safety-guard/` | Sicherheits-Constraints und Moderation (npm-Paket) |
| `tokens-per-second` | `tokens-per-second.ts` | Echtzeit-TPS-Anzeige (main + Subagenten) |
| `vigil-locks` | `vigil-locks/` | Datei-Sperren speziell für Vigil-Projekte |
| `web-search` | `web-search/` | Web-Search und URL-Fetch Tools (npm-Paket) |
| `workflow-compaction` | `workflow-compaction.ts` | Workflow-basierte Compaction (referenziert .tasks/, .pi/MEMORY.md) |

### Agent-Definitionen

| Agent | Datei | Beschreibung |
|---|---|---|
| `worker` | `agents/worker.md` | Strict Execution Agent — führt Tasks aus, keine Diskussion |

---

## Skills im Detail

### `dev-env` — Development Environment

**Frage:** "Wie arbeite ich?"

Der Haupt-Workflow-Skill. Definiert den vollständigen Lebenszyklus:

```
Phase 0: Init Memory (first session only)
Phase 1: Plan → approve
Phase 1.5: Bug Analysis (falls Bug)
Phase 1.6: App Smoke Check
Phase 2: Project Memory
Phase 3: Implement (via task-planning + subagents)
Phase 4: Tests
Phase 5: Code Review
Phase 6: Commit
Phase 7: Push
Phase 8: Knowledge Capture (Auto-Capture)
Phase 9: Documentation Update
```

**Spezielle Konzepte:**
- **Context Budget:** Max 300 Zeilen pro Read, grep-first, summaries statt raw output
- **Subagent Strategy:** Alles >30 Zeilen geht an Subagenten; orchestrator bleibt lean
- **Anti-Patterns:** Keine Web-Suche für Projekt-Fragen, kein Auslassen von Tests, kein Push ohne Permission

**Abhängigkeiten:** `task-planning`, `memory`, `knowledge-base`, `web-bash`

### `spec-to-app` — Specification to Application

**Frage:** "Wie generiere ich eine App aus einer Spec?"

Autonomer Fullstack-Workflow ohne User-Interaktion.

```
Phase 0: Init Memory
Phase 1: Spec Analysis
Phase 2: Project Planning (via task-planning)
Phase 3: Project Scaffolding
Phase 4: Data Layer
Phase 5: API Routes
Phase 6: Page Components
Phase 7: Unit Tests
Phase 8: Code Review
Phase 9: Functional Tests
Phase 10: Build Verification
Phase 11: Final Report
```

**Spezielle Konzepte:**
- **Codebase Map (Phase 2.5):** ONE Explore-Agent erstellt ein max. 80-Zeilen-Projekt-Map
- **Exploration Ban:** Implementation-Subagenten DÜRFEN NICHT explorieren — sie bekommen ihr Context aus der Map
- **NO QUESTS:** Spec wird autonom interpretiert, keine Rückfragen

### `task-planning` — Task Management

**Frage:** "Wie strukturiere ich Tasks?"

Autoritativer Task-Manager. Keine andere Skill erstellt Tasks direkt.

**Konzept: Aufgabe → Batch → Task**

```
.tasks/
  _index.md              ← Aktive Aufgabe + Liste aller Aufgaben
  bonding-group.md       ← Eine Datei pro Aufgabe (Kebab-Case-Slug)
```

**Besonderheiten:**
- **Worktrees:** Jede Aufgabe kann ein eigenes Worktree-Setup haben
- **Interrupts:** Automatisch pausieren, neue Aufgabe erstellen, später resume
- **Hard Gate:** Vor Commit prüfen: richtige Branch? Alle Tasks `[x]`? Tests grün?

### `memory` — Agent Memory

**Frage:** "Was weiß ich über User, Feedback, Projekt-Status?"

Typed, dateibasiertes Gedächtnis über Session-Grenzen hinweg.

**Memory-Typen:**

| Typ | Inhalt | Beispiel |
|---|---|---|
| `user` | Wer der User ist | Senior-Entwickler, Präferenzen, Wissensstand |
| `feedback` | Arbeitsweise-Korrekturen | "Keine DB-Mocks", "Keine Zusammenfassungen" |
| `project` | Laufende Arbeit | Merge-Freeze, Initiativen, Bugs |
| `reference` | Externe Systeme | "Linear = Pipeline-Bugs" |

**Format:** Regel → **Why:** (Begründung) → **How to apply:** (Geltungsbereich)

### `knowledge-base` — Project Knowledge

**Frage:** "Was weiß ich über Architektur, Patterns, Bugs?"

Suchbare Wissensdatenbank für Erkenntnisse, die nicht direkt aus dem Code ablesbar sind.

**Modi:**

| Modus | Wann | Was |
|---|---|---|
| **A — Lookup** | Frage zu bekanntem Thema | INDEX → Datei + § lesen → antworten |
| **B — Capture** | Session-Ende / explizit | Erkenntnisse identifizieren, zuordnen, speichern |
| **C — Neues Thema** | Noch kein KB-Eintrag | Neues Verzeichnis, neue Datei, INDEX-Eintrag |

**Format:** `§1`, `§2`, ... mit Quelle und Stand pro Abschnitt.

### `web-bash` — Web Search via Bash

**Frage:** "Wie suche ich im Web?"

Lightweight Web-Suche nur mit Bash. Kein Node-Dependency.

**Befehle:** DuckDuckGo, Stack Overflow API, Wikipedia, GitHub raw, URL → Markdown.

---

## Extensions im Detail

### `auto-continue.ts`

**Zweck:** Automatisches Fortsetzen bei Output-Token-Limit.

**Verhalten:**
- Feuert NUR bei `stopReason: length/max_tokens`, nicht bei normalem Ende
- Harte Obergrenze `MAX_CONSECUTIVE = 3` — verhindert Endlos-Schleifen
- Stricter Continuation-Prompt: KEINE neue Aufgabe, KEIN Wiederholen

**Installation:** `~/.pi/agent/extensions/auto-continue.ts` oder `<projekt>/.pi/extensions/`

### `compaction-metrics.ts`

**Zweck:** Passiver Beobachter für Compaction-Statistiken.

**Metriken:**
- `reason === "overflow"` = Turn wurde zu groß (das, was `read-limit` verhindert)
- `reason === "threshold"` = proaktive, gesunde Compaction
- `reason === "manual"` = `/compact`
- `tokensBefore bei overflow` = "wie groß wurde der Ballon"

**Log:** `.pi/compaction-metrics.jsonl` (projekt-lokal)

### `core-agent.ts`

**Zweck:** SystemPrompt- und Task-Injection für jede Session.

**Verhalten:**
- Task wird einmalig beim `agent_start` gespeichert
- SystemPrompt + Task werden IMMER injectet — auch bei Subagenten

### `pi-file-locks/`

**Zweck:** Datei-Sperren für Subagenten (verhindert concurrent edits).

**Features:**
- `agentId → Set<filePath>` Tracking
- Auto-release bei `subagents:completed` / `subagents:failed`
- Lock-Owner Map: `filePath → agentId`

### `read-limit.ts`

**Zweck:** Kapt Tool-Output auf Infrastruktur-Ebene.

**Mechanismen:**
1. `read`: `limit` vor der Ausführung klemmen → max `READ_LINES = 300`
2. `bash`: Output nach Ausführung kappen → letzte `BASH_LINES = 100` behalten, Rest nach `/tmp`

**Warum?** Ein einzelner Turn darf nicht über eine Compaction-Schwelle springen, bevor pi prüft.

### `safety-guard/` (npm-Paket)

**Zweck:** Sicherheits-Constraints und Moderation.

### `tokens-per-second.ts`

**Zweck:** Echtzeit-TPS-Anzeige (main + Subagenten).

**Features:**
- Rolling Window (3s)
- Combined-Status + Pro-Stream-Status
- Farblich kodiert (grün/rot)

### `vigil-locks/`

**Zweck:** Datei-Sperren speziell für Vigil-Projekte.

### `web-search/` (npm-Paket)

**Zweck:** `web_search` und `fetch_url` Tools für externe Recherche.

### `workflow-compaction.ts`

**Zweck:** Workflow-basierte Compaction (statt generischer LLM-Zusammenfassung).

**Verhalten:**
- Projekt hat `.tasks/` oder `.pi/MEMORY.md`? → strukturierte Referenz-Summary
- Sonst? → `undefined` (pi nutzt Standard-Compaction)

**Prinzip:** "Die Wahrheit liegt auf der Festplatte — der Context ist nur ein Arbeitsfenster."

---

## Agent-Definitionen

### `worker` — Strict Execution Agent

**Datei:** `agents/worker.md`

```markdown
You are a strict execution agent.

- You execute tasks, not discuss them
- You do not ask for the task again
- You immediately produce code
- You minimize tool usage
```

**Einsatz:** Wenn der User eine Aufgabe explizit delegiert und nur Ausführung will — keine Planung, keine Diskussion.

---

## Speicher-Architektur

Drei Speicher-Konzepte, keine Überschneidung.

```
.pi/
├── MEMORY.md              ← Projekt-Memory (statisch)
│                          Projektstruktur, Installation, Workflow, Rules
│
├── memory/                ← Agent-Memory (dynamisch)
│  ├── MEMORY.md           ← Index (Session-Start geladen)
│  ├── user_role.md        ← user-Typ
│  ├── feedback_*.md       ← feedback-Typ
│  ├── project_*.md        ← project-Typ
│  └── reference_*.md      ← reference-Typ
│
├── knowledge/             ← Projektwissen (dynamisch)
│  ├── INDEX.md            ← Lookup-Tabelle (Stichwort → Datei → Abschnitt)
│  ├── architecture/       ← Systemarchitektur
│  ├── patterns/           ← Wiederkehrende Idiome
│  ├── decisions/          ← Architektur-Entscheidungen
│  ├── bugs/               ← Bekannte Bugs, Ursachen
│  └── dev-environment/    ← Workspace-Setup, Tools
│
└── decisions/             ← (legacy/alternativ zu knowledge/)
```

### Wann was verwenden?

| Wenn du lernst... | Schreibe nach... | Skill |
|---|---|---|
| Wer der User ist, Präferenzen | `.pi/memory/` (user-Typ) | memory |
| Feedback zur Arbeitsweise | `.pi/memory/` (feedback-Typ) | memory |
| Wer was tut, warum, bis wann | `.pi/memory/` (project-Typ) | memory |
| Externe Systeme | `.pi/memory/` (reference-Typ) | memory |
| Projektstruktur, Tech-Stack | `.pi/MEMORY.md` | — (statisch) |
| Architektur, Patterns, Bugs | `.pi/knowledge/` | knowledge-base |

### Was NICHT in die Memory-Konzepte?

- Code-Patterns, Konventionen, Architektur → **aus Code ableitbar**
- Git-History → **`git log`/`git blame` sind autoritativ**
- Ephemere Task-Details → **gehört ins Git**
- Alles in Konfig-Dateien dokumentierte → **direkt lesbar**

---

## Abhängigkeiten

```
dev-env ──────────────→ task-planning (Task-Erstellung)
         ├────────────→ memory (Agent-Memory)
         ├────────────→ knowledge-base (Projektwissen)
         └────────────→ web-bash (Web-Suche)

spec-to-app ──────────→ task-planning (Task-Erstellung)
         ├────────────→ memory (Agent-Memory)
         └────────────→ knowledge-base (Projektwissen)

task-planning ────────→ (selbstständig)

memory ───────────────→ (selbstständig)

knowledge-base ───────→ (selbstständig)

web-bash ─────────────→ (selbstständig)
```

**Extensions** werden von pi automatisch geladen — keine expliziten Dependencies.

---

## Installation

```bash
# Skills
cp -r skills/* ~/.pi/agent/skills/

# Extensions
cp extensions/*.ts ~/.pi/agent/extensions/
cp -r extensions/*/ ~/.pi/agent/extensions/

# Agent-Definitionen
cp -r docs/agents ~/.pi/agent/agents/
```

Oder über `pi install` (wenn Paket als npm-Modul bereitgestellt).

---

## Entwicklung

```
docs/                ← Dokumentation (diese Datei)
  DOCS.md            ← Vollständige Übersicht
  SKILLS.md          ← Skills im Detail (aus DOCS.md extrahiert)
  agents/            ← Agent-Definitionen
extensions/          ← Extensions (TypeScript)
  *.ts               ← einzelne Dateien
  */                 ← Verzeichnis-Pakete
skills/              ← Skills (Markdown)
  */SKILL.md         ← Eine Datei pro Skill
```

**Skills entwickeln:** `skills/` direkt bearbeiten → `cp -r skills/* ~/.pi/agent/skills/`
**Extensions entwickeln:** `extensions/` direkt bearbeiten → `cp extensions/* ~/.pi/agent/extensions/`
**Agent-Definitionen:** `docs/agents/` → `~/.pi/agent/agents/`

---

## Changelog

| Version | Datum | Änderung |
|---|---|---|
| 1.0.0 | 2026-07-16 | Erste strukturierte Dokumentation aller Skills, Extensions und Agents |
