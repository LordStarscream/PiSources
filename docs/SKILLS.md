# Skills — Übersicht und Zusammenhänge

Dieses Dokument beschreibt alle Skills im `PiSources`-Paket, ihre Verantwortlichkeiten und wie sie zusammenarbeiten.

## Quick Reference

| Skill | Ort | Frage | Status |
|---|---|---|---|
| `dev-env` | `skills/dev-env/` | "Wie arbeite ich?" | Projekt-Workflow |
| `spec-to-app` | `skills/spec-to-app/` | "Wie generiere ich eine App?" | Spec-getrieben |
| `task-planning` | `skills/task-planning/` | "Wie strukturiere ich Tasks?" | Task-Manager |
| `memory` | `skills/memory/` | "Was weiß ich über User/Feedback/Projekt?" | Agent-Lernen |
| `knowledge-base` | `skills/knowledge-base/` | "Was weiß ich über Architektur/Patterns/Bugs?" | Projektwissen |
| `web-bash` | `skills/web-bash/` | "Wie suche ich im Web?" | Web-Suche |

---

## Die Skills

### 1. `dev-env` — Development Environment

**Frage:** "Wie arbeite ich?"

Der **Haupt-Workflow-Skill**. Er definiert, wie ein Entwickler mit einem Projekt interagiert:

```
Phase 0: Init Memory (first session only)
Phase 1: Plan
Phase 1.5: Bug Analysis (if bug report)
Phase 2: Project Memory
Phase 3: Implement (via task-planning)
Phase 4: Tests
Phase 5: Code Review
Phase 6: Commit
Phase 7: Push
```

**Verantwortlichkeiten:**
- Projekt-Discovery und Session Recovery
- cwd-first file search
- 7-Phasen-Workflow
- Git-Operationen (Commit, Push mit Permission-Check)
- Bug-Analyse (Phase 1.5)
- **Delegiert:** Task-Erstellung an `task-planning`, Memory-Updates an `memory` und `knowledge-base`

**Speicher-Richtlinien:**
- `.pi/MEMORY.md` → Projekt-Memory (statisch)
- `.pi/memory/` → Agent-Memory (dynamisch) via `memory`-Skill
- `.pi/knowledge/` → Projektwissen via `knowledge-base`-Skill

---

### 2. `spec-to-app` — Specification to Application

**Frage:** "Wie generiere ich eine App aus einer Spec?"

Ein **autonomer Fullstack-Workflow** der eine Spezifikation in eine lauffähige App übersetzt — ohne den User zu fragen.

```
Phase 0: Init Memory (first session only)
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

**Verantwortlichkeiten:**
- Spec-Analyse und -Interpretation
- Autonomes Implementieren (NO QUESTS)
- Spec-Interpretation Rules (Defaults, Convention, Consistency)
- **Delegiert:** Task-Erstellung an `task-planning`, Memory-Updates an `memory` und `knowledge-base`

**Speicher-Richtlinien:**
- `.pi/MEMORY.md` → Projekt-Memory + Spec Interpretations
- `.pi/memory/` → Agent-Memory für User-Feedback
- `.pi/knowledge/` → Architektur- und Pattern-Erkenntnisse

---

### 3. `task-planning` — Task Management

**Frage:** "Wie strukturiere ich Tasks?"

Der **autoritative Task-Manager**. Keine andere Skill erstellt oder verwaltet Task-Listen direkt.

**Konzept: Aufgabe → Batch → Task**

```
.tasks/
  _index.md              ← active Aufgabe + list of all Aufgaben
  bonding-group.md       ← one file per Aufgabe
```

**Verantwortlichkeiten:**
- Aufgabe-Erstellung (slug, Branches, Worktrees)
- Batch-Gruppierung (logische Zusammenhänge)
- Task-Tracking (`[ ]` → `[~]` → `[x]`)
- Completion Notes (Was wurde gemacht, warum)
- Batch Summaries (zwischen Batches)
- Interruption Handling (Aufgabe pausieren, neue erstellen, später resume)
- Hard Gate (Branch, Tasks `[x]`, Tests/Review)
- Wrap-Up (erledigt, Worktree schließen, Doku schreiben)

**Wer nutzt es:** `dev-env` und `spec-to-app` delegieren Task-Erstellung und -Pfle ge an diesen Skill.

---

### 4. `memory` — Agent Memory

**Frage:** "Was weiß ich über den User, das Feedback, den Projekt-Status?"

Ein **typed, dateibasiertes Gedächtnis** das session-übergreifend lernt.

**Dateien:**
```
.pi/memory/
  MEMORY.md              ← Index (wird zu Session-Start geladen)
  user_role.md           ← user-Typ
  feedback_no_db_mocks.md ← feedback-Typ
  project_mobile_release.md ← project-Typ
  reference_linear.md     ← reference-Typ
```

**Memory-Typen:**

| Typ | Was | Beispiel |
|---|---|---|
| `user` | Wer der User ist | Senior-Entwickler, Präferenzen, Wissensstand |
| `feedback` | Arbeitsweise-Korrekturen | "Keine DB-Mocks", "Keine Zusammenfassungen" |
| `project` | Laufende Arbeit | Merge-Freeze, Initiativen, Bugs |
| `reference` | Externe Systeme | "Linear-Projekt INGEST = Pipeline-Bugs" |

**Body-Struktur:** Regel → **Why:** (Begründung) → **How to apply:** (Geltungsbereich)

**Wer nutzt es:** `dev-env` und `spec-to-app` nutzen es für User-Feedback und Projekt-Kontext.

---

### 5. `knowledge-base` — Project Knowledge

**Frage:** "Was weiß ich über die Architektur, Patterns, Bugs des Projekts?"

Eine **suchbare Wissensdatenbank** für Erkenntnisse die nicht direkt aus dem Code ablesbar sind.

**Dateien:**
```
.pi/knowledge/
  INDEX.md               ← Lookup-Tabelle (Stichwort → Datei → Abschnitt)
  architecture/overview.md
  patterns/common-patterns.md
  decisions/auth-choice.md
  bugs/legacy-middleware.md
```

**Modi:**

| Modus | Wann | Was |
|---|---|---|
| **A — Lookup** | Frage zu bekanntem Thema | INDEX → Datei + § lesen → antworten |
| **B — Capture** | Session-Ende / explizit | Erkenntnisse identifizieren, zuordnen, speichern |
| **C — Neues Thema** | Noch kein KB-Eintrag | Neues Verzeichnis, neue Datei, INDEX-Eintrag |

**Format:** `§1`, `§2`, ... mit Quelle und Stand pro Abschnitt.

**Auto-Capture:** Am Ende jeder Session nach neuen Erkenntnissen suchen.

**Wer nutzt es:** `dev-env` und `spec-to-app` nutzen es für Architektur- und Pattern-Erkenntnisse.

---

### 6. `web-bash` — Web Search via Bash

**Frage:** "Wie suche ich im Web?"

Lightweight web search using only bash commands.

**Befehle:**
| Aufgabe | Befehl |
|---|---|
| DuckDuckGo | `curl ... html.duckduckgo.com ...` |
| Stack Overflow API | `curl ... stackoverflow.com/2.3/search/advanced ...` |
| Wikipedia | `curl ... en.wikipedia.org/w/api.php ...` |
| GitHub raw | `curl ... raw.githubusercontent.com ...` |
| URL → Markdown | `bash tools/fetch_md.sh <url>` |

**Wer nutzt es:** Alle Skills nutzen es für single-source quick lookups.

---

## Speicher-Architektur

Drei Speicher-Konzepte existieren parallel. Keine Überschneidung.

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
└── knowledge/             ← Projektwissen (dynamisch)
   ├── INDEX.md            ← Lookup-Tabelle
   ├── architecture/       ← Systemarchitektur
   ├── patterns/           ← Wiederkehrende Idiome
   ├── decisions/          ← Architektur-Entscheidungen
   ├── bugs/               ← Bekannte Bugs, Ursachen
   └── dev-environment/    ← Workspace-Setup, Tools
```

### Wann was verwenden?

| Wenn du lernst... | Schreibe nach... | Warum |
|---|---|---|
| Wer der User ist, Präferenzen, Wissenstand | `.pi/memory/` (user-Typ) | Kalibriert den Assistenten |
| Feedback zur Arbeitsweise | `.pi/memory/` (feedback-Typ) | Rule mit Why + How to apply |
| Wer was tut, warum, bis wann | `.pi/memory/` (project-Typ) | Kontext hinter der Arbeit |
| Externe Systeme und ihre Zwecke | `.pi/memory/` (reference-Typ) | Wo nachschauen |
| Projektstruktur, Tech-Stack, Installation | `.pi/MEMORY.md` | Statisch, projektspezifisch |
| Architektur, Patterns, Bug-Ursachen | `.pi/knowledge/` | Aus Exploration gelernt, suchtbar |

### Was NICHT in den Memory-Konzepte?

- Code-Patterns, Konventionen, Architektur, Dateipfade → **aus Code ableitbar**
- Git-History → **`git log`/`git blame` sind autoritativ**
- Ephemere Task-Details → **gehört ins Git**
- Alles was bereits in Konfig-Dateien dokumentiert ist

---

## Session-Flow (dev-env)

```
Session startet
  │
  ├─ Phase 0: Init Memory (first session only)
  │   ├─ .pi/MEMORY.md erstellen (Template)
  │   ├─ .pi/memory/MEMORY.md erstellen (Index)
  │   └─ .pi/knowledge/INDEX.md erstellen (Index)
  │
  ├─ Phase 1: Plan
  │   └─ Plan erstellen → approve → Memory-Richtlinien sichtbar
  │
  ├─ Phase 1.5: Bug Analysis (falls Bug)
  │   └─ Investigate → Root Cause → Fix → approve
  │
  ├─ Phase 2: Project Memory
  │   ├─ .pi/MEMORY.md aktualisieren (statisch)
  │   ├─ .pi/memory/ (via memory-Skill, falls relevant)
  │   └─ .pi/knowledge/ (via knowledge-base-Skill, falls relevant)
  │
  ├─ Phase 3: Implement (via task-planning)
  │   └─ Tasks: [ ] → [~] → [x] mit Completion Notes
  │
  ├─ Phase 4: Tests
  ├─ Phase 5: Code Review
  ├─ Phase 6: Commit
  └─ Phase 7: Push (mit Permission-Check)
```

---

## Skill-Abhängigkeiten

```
dev-env ──────────────→ task-planning (Task-Erstellung)
         ├────────────→ memory (Agent-Memory)
         └────────────→ knowledge-base (Projektwissen)
         └────────────→ web-bash (Web-Suche)

spec-to-app ──────────→ task-planning (Task-Erstellung)
         ├────────────→ memory (Agent-Memory)
         └────────────→ knowledge-base (Projektwissen)

task-planning ────────→ (selbstständig)

memory ───────────────→ (selbstständig)

knowledge-base ───────→ (selbstständig)

web-bash ─────────────→ (selbstständig)
```

---

## Installation

```bash
cd /home/mario/Projects/PiSources
pi install ./
pi list  # verify installation
```

Skills werden nach `~/.pi/agent/skills/` kopiert und sind über `/skill:name` aufrufbar.

---

## Development Workflow (Skills entwickeln)

```
skills/              ← dev source of truth
  ├── dev-env/
  ├── spec-to-app/
  ├── task-planning/
  ├── memory/
  ├── knowledge-base/
  └── web-bash/

.pi/
  ├── skills/        ← local test copy (gitignored)
  └── extensions/    ← local test copy

~/.pi/agent/skills/  ← global (deployed)
```

**Entwicklung:** `skills/` direkt bearbeiten.
**Test:** `cp -r skills .pi/` und `pi` starten.
**Deploy:** `cp -r skills/* ~/.pi/agent/skills/`.
