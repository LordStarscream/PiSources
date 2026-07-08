---
name: memory
description: >
  Persistentes, dateibasiertes Gedächtnis für den AI-Assistenten.
  Speichert und lädt Informationen über den User, Feedback zur Arbeitsweise,
  Projekt-Kontext und Referenzen auf externe Ressourcen — sessionübergreifend.
memory_root: .pi/memory
---

# Memory Skill

Persistentes Gedächtnis, das über einzelne Sessions hinaus erhalten bleibt.
Ziel: Der Assistent lernt, wer der User ist, wie er arbeiten möchte, und
was hinter der aktuellen Arbeit steckt — ohne dass der User es jedes Mal neu erklären muss.

## Konfiguration

**`memory_root`** — Pfad zum Memory-Verzeichnis, relativ zum Projektroot (oder als absoluter Pfad).  
Default: `.pi/memory/`  
Anpassen je nach AI-CLI und Setup:

| CLI / Setup | Empfohlener Pfad |
|---|---|
| pi (persönlicher Assistent) | `.pi/memory/` |
| Claude Code | `~/.claude/projects/<id>/memory/` |
| Generisch | `.ai/memory/` |

---

## Struktur

```
<memory_root>/
  MEMORY.md           ← Index, wird in jede Session geladen
  user_role.md        ← eine Datei pro Memory-Eintrag
  feedback_testing.md
  project_release.md
  reference_linear.md
```

### MEMORY.md — der Index

`MEMORY.md` wird **immer** zu Beginn jeder Session in den Kontext geladen.
Er enthält nur Zeiger — niemals Memory-Inhalt direkt.

Format: eine Zeile pro Eintrag, unter ~150 Zeichen:
```markdown
# Memory Index

- [Titel](datei.md) — ein-Satz-Hook was drin steht
- [User-Rolle](user_role.md) — Senior Backend-Entwickler, neu im Frontend dieses Projekts
- [Test-Feedback](feedback_testing.md) — keine DB-Mocks; Integration-Tests müssen echte DB treffen
```

**Wichtig:** Zeilen nach 200 werden abgeschnitten — Index knapp halten.

### Memory-Datei — Format

Jede Memory-Datei hat Frontmatter + Inhalt:

```markdown
---
name: <kebab-case-slug>
description: <eine Zeile — wird genutzt um Relevanz zu beurteilen, also spezifisch sein>
metadata:
  type: <user | feedback | project | reference>
---

<Inhalt>
```

Verwandte Memories mit `[[name]]` verlinken (Name = slug der anderen Datei).
Ein Link auf einen noch nicht existierenden Eintrag ist kein Fehler — er markiert etwas Erwähnenswertes.

---

## Memory-Typen

### `user` — Wer ist der User?

Rolle, Ziele, Verantwortlichkeiten, Wissensstand. Hilft den Assistenten zu kalibrieren:
Ein Senior-Entwickler braucht andere Erklärungen als ein Einsteiger.

**Wann speichern:** Wenn Details über Rolle, Präferenzen oder Wissenstand bekannt werden.

**Beispiele:**
```markdown
user: Ich bin Data Scientist und untersuche gerade unser Logging
→ [speichern: User ist Data Scientist, fokus auf Observability/Logging]

user: Go kenne ich seit zehn Jahren, aber React ist neu für mich
→ [speichern: tiefe Go-Expertise, React und dieses Frontend neu — Frontend-Erklärungen in Backend-Analogien rahmen]
```

**Inhalt:** Fakten, keine Werturteile. Nur was für die Zusammenarbeit relevant ist.

---

### `feedback` — Wie soll gearbeitet werden?

Korrekturen ("nicht so", "hör auf mit X") **und** Bestätigungen ("genau", "perfekt, weiter so").
Korrekturen sind leicht zu erkennen; Bestätigungen sind leiser — auf beide achten.

**Wann speichern:** Wenn der User die Vorgehensweise korrigiert oder eine nicht-offensichtliche Wahl bestätigt.

**Body-Struktur:** Regel zuerst, dann **Why:** (Begründung) und **How to apply:** (wann greift die Regel).
Die Begründung ermöglicht es, Grenzfälle selbst zu beurteilen.

**Beispiele:**
```markdown
user: keine DB-Mocks in diesen Tests — wir wurden letztes Quartal erwischt als Mock-Tests grüne CI hatten aber die Prod-Migration kaputt war
→ [speichern: Integration-Tests müssen echte DB treffen, keine Mocks.
   Why: Divergenz Mock/Prod hat gebrochene Migration maskiert.
   How to apply: bei jedem Test-Entwurf der eine DB berührt]

user: hör auf, am Ende jeder Antwort zusammenzufassen was du gerade gemacht hast
→ [speichern: keine abschließenden Zusammenfassungen.
   Why: User kann den Diff lesen.
   How to apply: immer]

user: ja, ein gebündelter PR war hier richtig, das aufzuteilen wäre nur Overhead gewesen
→ [speichern: für Refactorings in diesem Bereich einen gebündelten PR bevorzugen — bestätigte Entscheidung, keine Korrektur]
```

---

### `project` — Was läuft gerade?

Laufende Arbeit, Ziele, Initiativen, Bugs, Incidents. Kontext hinter dem was der User tut.

**Wann speichern:** Wenn bekannt wird wer was tut, warum, oder bis wann.
Relative Daten in absolute umwandeln beim Speichern ("Donnerstag" → "2026-07-10").

**Body-Struktur:** Fakt/Entscheidung zuerst, dann **Why:** und **How to apply:**. Project-Memories veralten schnell — die Begründung hilft zu beurteilen ob der Eintrag noch gültig ist.

**Beispiele:**
```markdown
user: ab Donnerstag Merge-Freeze — Mobile schneidet einen Release-Branch
→ [speichern: Merge-Freeze ab 2026-07-10 wegen Mobile-Release-Cut.
   Why: Release-Branch-Stabilisierung.
   How to apply: nicht-kritische PRs nach diesem Datum flaggen]

user: der Grund warum wir die alte Auth-Middleware rausreißen ist dass Legal bemängelt hat wie wir Session-Tokens speichern
→ [speichern: Auth-Middleware-Rewrite durch Legal/Compliance getrieben, nicht Tech-Debt.
   Why: Session-Token-Speicherung erfüllt neue Compliance-Anforderungen nicht.
   How to apply: Scope-Entscheidungen zugunsten Compliance, nicht Ergonomie]
```

---

### `reference` — Wo finde ich was?

Zeiger auf externe Systeme und ihren Zweck. Damit der Assistent weiß wo er nachschauen soll.

**Wann speichern:** Wenn ein externes System und sein Zweck bekannt wird.

**Beispiele:**
```markdown
user: Pipeline-Bugs tracken wir im Linear-Projekt "INGEST"
→ [speichern: Pipeline-Bugs → Linear-Projekt "INGEST"]

user: das Grafana-Board unter grafana.internal/d/api-latency ist was Oncall beobachtet
→ [speichern: grafana.internal/d/api-latency = Oncall-Latenz-Dashboard — checken wenn Request-Path-Code angefasst wird]
```

---

## Was NICHT in Memory gehört

- Code-Patterns, Konventionen, Architektur, Dateipfade — aus dem Code ableitbar
- Git-History, wer was wann geändert hat — `git log`/`git blame` sind autoritativ
- Debugging-Lösungen oder Fix-Rezepte — der Fix steckt im Code, der Kontext im Commit-Message
- Alles was bereits in Konfig-Dateien dokumentiert ist (z.B. `CLAUDE.md`, `README`)
- Ephemere Task-Details, laufende Arbeit, aktueller Session-Kontext

Diese Ausnahmen gelten auch wenn der User explizit bittet, etwas zu speichern.
Wenn jemand eine PR-Liste oder Activity-Summary speichern möchte: fragen was daran
**überraschend oder nicht-offensichtlich** war — das ist der Teil der sich lohnt.

---

## Memory speichern — zwei Schritte

**Schritt 1** — Memory-Datei schreiben:

```markdown
---
name: feedback-no-db-mocks
description: Integration-Tests müssen echte DB treffen, keine Mocks — Divergenz hat Prod-Migration kaputt maskiert
metadata:
  type: feedback
---

Keine DB-Mocks in Integration-Tests.

**Why:** Im letzten Quartal haben Mock-Tests grüne CI geliefert obwohl die Prod-Migration kaputt war — Divergenz Mock/Prod hat den Fehler maskiert.

**How to apply:** Bei jedem Test-Entwurf der eine DB berührt. Gilt auch für neue Services.
```

**Schritt 2** — Eintrag in `MEMORY.md` hinzufügen:

```markdown
- [Kein DB-Mock](feedback-no-db-mocks.md) — Integration-Tests müssen echte DB treffen; Mocks haben letztes Quartal kaputte Migration maskiert
```

---

## Memory lesen und anwenden

- `MEMORY.md` wird zu Sessionbeginn geladen — Einträge sind sofort verfügbar.
- Wenn ein Eintrag einen spezifischen Dateinamen, eine Funktion oder ein Flag nennt: verifizieren dass er noch existiert, bevor er empfohlen wird. Memories können veralten.
- Bei Konflikt zwischen Memory und aktuellem Code/Zustand: dem aktuellen Zustand vertrauen und den Memory aktualisieren oder löschen.
- Wenn der User sagt "ignoriere das Memory" oder "vergiss das": nicht anwenden, nicht zitieren, nicht erwähnen.

---

## Memory aktualisieren und löschen

- Vor dem Anlegen eines neuen Eintrags prüfen ob ein bestehender aktualisiert werden kann.
- Veraltete oder falsche Einträge löschen — nicht als Kommentar stehen lassen.
- `MEMORY.md` und die Datei immer synchron halten.

---

## Erstes Setup

Wenn `<memory_root>/MEMORY.md` noch nicht existiert:

```bash
mkdir -p <memory_root>
```

Dann eine leere `MEMORY.md` anlegen:

```markdown
# Memory Index
```

Und direkt mit dem ersten bekannten Eintrag befüllen.
