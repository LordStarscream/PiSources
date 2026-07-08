---
name: knowledge-base
description: >
  Lookup- und Capture-Skill für eine projektlokale Wissensdatenbank.
  Aktiviert bei: "was weißt du über X", "schlag nach X", "capture",
  "Erkenntnisse sichern", "knowledge", "was haben wir heute gelernt",
  oder am Ende einer Session als Auto-Capture.
kb_root: .pi/knowledge
---

# Knowledge Base Skill

Projektlokale Wissensdatenbank für alles, was nicht direkt aus dem Code ablesbar ist:
Architektur-Zusammenhänge, Protokolle, Konventionen, Bugs und ihre Ursachen, Entscheidungen.

## Konfiguration

**`kb_root`** — Pfad zur Wissensdatenbank, relativ zum Projektroot.  
Default: `.pi/knowledge/`  
Anpassen je nach AI-CLI und Projektkonvention:

| CLI / Setup | Empfohlener Pfad |
|---|---|
| pi (persönlicher Assistent) | `.pi/knowledge/` |
| Claude Code | `.claude/projects/<id>/knowledge/` |
| Generisch | `.ai/knowledge/` oder `knowledge/` |

Beim ersten Einsatz in einem neuen Projekt: prüfen ob `<kb_root>/INDEX.md` existiert.
Falls nicht → Modus C (Neues Thema) ausführen und INDEX anlegen.

---

## Verzeichnisstruktur

```
<kb_root>/
  INDEX.md                  ← Lookup-Tabelle (Einstiegspunkt)
  <kategorie>/
    <thema>.md
```

**Empfohlene Kategorien** (an das Projekt anpassen):

```
<kb_root>/
  INDEX.md
  architecture/             ← Systemarchitektur, Komponenten, Datenfluss
  dev-environment/          ← Workspace-Setup, Tools, Scripts
  patterns/                 ← Wiederkehrende Idiome, Konventionen
  decisions/                ← Architektur- und Design-Entscheidungen
  bugs/                     ← Bekannte Bugs, Ursachen, Workarounds
```

### INDEX.md Format

```markdown
# Knowledge Base — Index
_Projekt: <Projektname>_

## Lookup-Tabelle

| Thema / Stichwort | Datei | Abschnitt |
|---|---|---|
| <Stichwörter komma-getrennt> | `<kategorie>/<datei>.md` | §N oder "alle" |

---

## Dateien

\`\`\`
<kb_root>/
├── INDEX.md
├── architecture/
│   └── overview.md
└── patterns/
    └── common-patterns.md
\`\`\`

## Wie der Knowledge-Skill diese Datei nutzt

1. Stichwort aus Aufgabe extrahieren
2. Passende Zeile in der Lookup-Tabelle finden
3. Nur die genannte Datei + den genannten §-Abschnitt lesen — nie alles vorab
4. Nie alles vorab laden
```

### Themen-Datei Format

```markdown
## §1 <Thema>

<Erklärung, maximal 10 Zeilen>

**Quelle:** <wie wurde das herausgefunden: Code-Exploration, Bug-Fix, User-Erklärung>
**Stand:** <YYYY-MM-DD>

---

## §2 <Nächstes Thema>
...
```

---

## Modus A — Lookup (Wissen nachladen)

**Auslöser:** Frage zu einem Thema, das in der KB liegen könnte.

1. `<kb_root>/INDEX.md` lesen.
2. Passendes Thema in der Lookup-Tabelle finden — Stichwortabgleich.
3. **Nur** die genannte Datei + den genannten § laden — nie alles vorab.
4. Antwort auf Basis des geladenen Inhalts geben.
5. Hinweis wenn der Inhalt veraltet wirkt (Platzhalter, altes Datum).

Wenn kein passender Eintrag im INDEX: direkt zu Modus C.

---

## Modus B — Capture (Erkenntnisse sichern)

**Auslöser:** Session-Ende, oder expliziter Aufruf `/knowledge capture`.

### Vorgehen

1. **Erkenntnisse identifizieren** — Was haben wir heute gelernt? Checke:
   - Neue Zusammenhänge verstanden (wie X mit Y interagiert)
   - Bugs gefunden + Ursache lokalisiert
   - Architektur-Details entdeckt (Dateistruktur, Service-Registrierung, Protokoll)
   - Patterns gesehen (wiederkehrendes Idiom)
   - Entscheidungen getroffen (warum X statt Y)
   - Offene Fragen / unklare Stellen

2. **Thema zuordnen** — INDEX.md lesen, passendes Thema und Datei bestimmen.
   Wenn kein passendes Thema: Modus C ausführen.

3. **Inhalt schreiben** — In die Zieldatei an der richtigen Stelle einfügen:
   - Platzhalter ersetzen wenn jetzt bekannt
   - Neue §§ anlegen wenn kein passender Abschnitt existiert
   - Datum am Ende aktualisieren

4. **Kurze Zusammenfassung** — Dem User mitteilen was gespeichert wurde (1–3 Zeilen).
   Bei nichts Neuem: kurz bestätigen "Keine neuen KB-Einträge nötig."

### Was NICHT captured werden soll

- Ephemere Task-Details (was genau in dieser Session gebaut wurde — gehört ins Git)
- Code-Snippets die sich schnell ändern — nur Prinzipien und Zusammenhänge
- Dinge die direkt aus dem Code ablesbar sind (Namen, Signaturen, offensichtliche Struktur)

---

## Modus C — Neues Thema anlegen

Wenn eine Frage zu einem Thema kommt, das noch keine KB-Datei hat:

1. Passendes Unterverzeichnis wählen oder neu anlegen.
2. Neue `.md`-Datei nach dem §-Skelett-Muster anlegen.
3. INDEX-Eintrag hinzufügen (Lookup-Tabelle + Dateiliste).
4. Direkt mit dem bekannten Wissen füllen.

**Neue Datei anlegen:**
```bash
mkdir -p <kb_root>/<kategorie>
# Datei schreiben mit §-Struktur
```

**INDEX-Eintrag ergänzen:**
```markdown
| <Stichwörter> | `<kategorie>/<datei>.md` | alle |
```

---

## Auto-Capture am Session-Ende

Am Ende jeder Session — unabhängig davon ob der User es explizit anfordert:

1. Zurückblicken: Was war das Thema? Was haben wir herausgefunden?
2. Wenn mindestens eine neue, nicht-triviale Erkenntnis: Modus B ausführen.
3. Wenn nichts Neues: kurz bestätigen "Keine neuen KB-Einträge nötig."

---

## Erstes Setup in einem neuen Projekt

Wenn `<kb_root>/INDEX.md` noch nicht existiert:

```bash
mkdir -p <kb_root>
```

Dann eine minimale `INDEX.md` anlegen:

```markdown
# Knowledge Base — Index
_Projekt: <Projektname>_

## Lookup-Tabelle

| Thema / Stichwort | Datei | Abschnitt |
|---|---|---|

---

## Dateien

\`\`\`
<kb_root>/
└── INDEX.md
\`\`\`
```

Und direkt mit dem ersten bekannten Thema befüllen (Modus C).
