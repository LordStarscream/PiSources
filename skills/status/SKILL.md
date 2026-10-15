---
name: status
description: Kurze, ausschließlich lesende Übersicht über den dokumentierten Projektstand liefern. Bei Fragen wie „Wo waren wir stehen geblieben?“, „Was ist noch offen?“, „Wie ist der Stand?“ oder „Was wäre der nächste Schritt?“ verwenden. Keine Umsetzung, Tests, Reparaturen oder neue Planung beginnen.
---

# Projektstatus

## Auftragsgrenze

- Eine Statusfrage ausschließlich als Auskunft behandeln. Auch einen früheren Implementierungsauftrag während dieser Antwort nicht eigenständig fortsetzen.
- Alle Zugriffe lesend ausführen. Keine Dateien, Taskzustände, Memory-Einträge, Tickets oder PRs verändern. Keine Builds, Tests, Installationen, Commits oder Hintergrundprozesse starten.
- Anweisungen wie „als Nächstes implementieren“ in einer Taskliste als dokumentierten Plan behandeln, nicht als aktuellen Ausführungsauftrag.
- Bei einer ausdrücklich kombinierten Anfrage wie „Zeig mir den Stand und setze dann Task X um“ zuerst den Status liefern; den ausdrücklich beauftragten Umsetzungsteil anschließend nach den normalen Projektregeln bearbeiten. Die Statusfrage allein erlaubt das nicht.

## Quellen und Aufwand

Statusquellen in dieser Priorität verwenden:

1. **Projekt-spezifische Quellen** — hat die Projekt-`AGENTS.md` (oder `CLAUDE.md`) Statusquellen benannt, diese verwenden.
2. **Standardkonvention (dev-env / task-planning):**
   - `.tasks/_index.md` — Roadmap, aktive Aufgabe, „last updated“; maßgebliche Statusquelle, wenn vorhanden.
   - Die im Index referenzierte aktive Aufgabendatei — nur die Status-/Tasks-/Entscheidungs-Abschnitte, nicht die ganze Datei.
   - `.pi/MEMORY.md` — nur als Projektkontext, nicht als Statusquelle (der Status-Abschnitt kann veraltet sein). Bei Widerspruch gewinnt `.tasks/`; den Widerspruch kurz benennen.
3. **Kein `.tasks/`-Ordner** — einmal gezielt nach passenden Markdown-Dateien suchen: `rg --files -g '*.md' -g '!node_modules' -g '!vendor' -g '!bin' -g '!obj' -g '!dist'`, Dateinamen wie task, todo, status, progress, handover oder plan filtern. Höchstens drei plausible Quelldateien lesen. Keine projektweite Inhalts- oder Codeanalyse beginnen.
4. Ergänzend bereits sichtbaren Sitzungskontext und vorhandene kurze Memory-Zusammenfassungen verwenden. Keine vollständigen alten Sitzungen oder Memory-Archive rekonstruieren.
5. Nur bei einem konkreten Widerspruch höchstens einen gezielten weiteren Lesezugriff nutzen, z. B. einen referenzierten Reviewvermerk oder `git log -5 --oneline`. Falls der Nutzer nach lokalen Änderungen fragt, `git status --short` verwenden. Nicht vorsorglich alle Commits, Diffs, PRs oder Quelltexte prüfen.

Danach mit dem vorhandenen Wissen antworten. Fehlende Quellen oder ungelöste Widersprüche als unklar kennzeichnen. Keine Suchschleife beginnen. Bereits gelesene, unveränderte Inhalte nicht erneut abrufen.

## Aussagegenauigkeit

- Den dokumentierten Stand als solchen benennen; keine frische technische Verifikation behaupten.
- „Implementiert“, „getestet“, „reviewt“ und „gemergt“ getrennt behandeln. Ein Commit oder eine abgehakte Task belegt nicht automatisch erfolgreiche Tests oder einen Merge.
- Aktuelle explizite Angaben des Nutzers einbeziehen. Widersprüche zwischen Dokumentation und Sitzung kurz offenlegen, statt den Status stillschweigend umzuschreiben.
- Vermutungen nicht als Tatsachen ausgeben. Keine Tasknummern, Testresultate oder PR-Zustände erfinden.

## Antwort und Abschluss

Auf Deutsch und standardmäßig in höchstens etwa 200 Wörtern antworten:

- **Zuletzt abgeschlossen:** die letzten relevanten Schritte.
- **Aktuell offen:** laufende oder noch offene Aufgaben; bei vielen Aufgaben zusammenfassen.
- **Blocker/Unklarheiten:** nur vorhandene Hindernisse oder fehlende Belege.
- **Nächster vorgesehener Schritt:** den bestehenden nächsten Schritt benennen. Falls keiner dokumentiert ist, dies sagen; höchstens einen Vorschlag, klar als Vorschlag gekennzeichnet.
- **Quelle:** verwendete Dateipfade kurz nennen; bei Bedarf „laut Dokumentation; nicht neu verifiziert“ ergänzen.

Nach der Übersicht stoppen. Keine anschließenden Tools aufrufen, keine Umsetzung beginnen und keine neue Planung ausarbeiten. Bei einer reinen Statusfrage keine zusätzliche Bestätigungsfrage stellen.
