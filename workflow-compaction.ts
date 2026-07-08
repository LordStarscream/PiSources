/**
 * workflow-compaction.ts
 *
 * Custom Compaction für Workflow-basierte Projekte (dev-env / spec-to-app Skills).
 *
 * Statt einer generischen LLM-Zusammenfassung verweist die Compaction auf die
 * persistierten Workflow-Files (.tasks/, .pi/MEMORY.md, .pi/decisions/, .pi/knowledge/)
 * und erhält nur die essenziellen Steuerungs-Infos im Context.
 *
 * Die Wahrheit liegt auf der Festplatte — der Context ist nur ein Arbeitsfenster.
 *
 * Installation:
 *   ~/.pi/agent/extensions/workflow-compaction.ts   (global)
 *   <projekt>/.pi/extensions/workflow-compaction.ts (projekt-lokal)
 *
 * Verhalten:
 *   - Wenn das Projekt Workflow-Strukturen hat (.tasks/ oder .pi/MEMORY.md):
 *     → strukturierte Referenz-Summary, LLM-Summarization des Verlaufs entfällt
 *   - Wenn nicht: → return undefined, pi nutzt die Standard-Compaction
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { convertToLlm, serializeConversation } from "@mariozechner/pi-coding-agent";
import * as fs from "fs";
import * as path from "path";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function readIfExists(filePath: string, maxChars = 4000): string | null {
    try {
        if (!fs.existsSync(filePath)) return null;
        const content = fs.readFileSync(filePath, "utf-8");
        if (content.length > maxChars) {
            return content.slice(0, maxChars) + `\n[... gekürzt, volle Datei: ${filePath}]`;
        }
        return content;
    } catch {
        return null;
    }
}

function listDirEntries(dirPath: string, limit = 15): string[] {
    try {
        if (!fs.existsSync(dirPath)) return [];
        return fs
            .readdirSync(dirPath)
            .filter((f) => !f.startsWith("."))
            .sort()
            .slice(-limit); // die neuesten (alphabetisch = zeitlich bei timestamp-prefix)
    } catch {
        return [];
    }
}

/**
 * Extrahiert die letzten User-Anweisungen aus den zu summarisierenden Messages.
 * Diese sind wichtig: die ursprüngliche Aufgabenstellung darf nicht verloren gehen.
 */
function extractUserGoals(messagesToSummarize: unknown[], maxGoals = 3): string[] {
    const goals: string[] = [];
    try {
        const serialized = serializeConversation(convertToLlm(messagesToSummarize as never));
        const userLines = serialized
            .split("\n")
            .filter((l: string) => l.startsWith("[User]:"))
            .map((l: string) => l.replace("[User]:", "").trim())
            .filter((l: string) => l.length > 10); // triviale Bestätigungen überspringen
        // Erste (ursprüngliches Ziel) + letzte N-1 (aktuelle Richtung)
        if (userLines.length > 0) {
            goals.push(userLines[0]);
            for (const line of userLines.slice(-(maxGoals - 1))) {
                if (!goals.includes(line)) goals.push(line);
            }
        }
    } catch {
        // Serialization fehlgeschlagen — Goals bleiben leer, Files tragen die Info
    }
    return goals.map((g) => (g.length > 300 ? g.slice(0, 300) + "…" : g));
}

// ─────────────────────────────────────────────
// Extension
// ─────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
    pi.on("session_before_compact", async (event, ctx) => {
        const { preparation, reason } = event;
        const cwd = ctx.cwd ?? process.cwd();

        // Workflow-Strukturen erkennen
        const tasksIndex = path.join(cwd, ".tasks", "_index.md");
        const memoryFile = path.join(cwd, ".pi", "MEMORY.md");
        const decisionsDir = path.join(cwd, ".pi", "decisions");
        const orchestratorState = path.join(cwd, ".pi", "orchestrator_state.md");
        const knowledgeIndex = path.join(cwd, ".pi", "knowledge", "INDEX.md");

        const hasWorkflow = fs.existsSync(tasksIndex) || fs.existsSync(memoryFile);

        // Kein Workflow-Projekt → Standard-Compaction verwenden
        if (!hasWorkflow) {
            return undefined;
        }

        // ── Workflow-Summary bauen ──

        const sections: string[] = [];

        sections.push(
            "## Session-Kontext (Workflow-Compaction)",
            "",
            "Ältere Messages wurden entfernt. Der vollständige Zustand liegt in den " +
                "Workflow-Files auf der Festplatte. Lies bei Bedarf gezielt nach — " +
                "NICHT alles vorab laden.",
            ""
        );

        // 1. Ursprüngliche + aktuelle User-Ziele (aus den wegfallenden Messages gerettet)
        const goals = extractUserGoals(preparation.messagesToSummarize ?? []);
        if (goals.length > 0) {
            sections.push("### Nutzer-Ziele (aus kompaktierter History)");
            for (const g of goals) sections.push(`- ${g}`);
            sections.push("");
        }

        // 2. Orchestrator-State (falls der Skill einen pflegt) — komplett einbetten
        const orchState = readIfExists(orchestratorState, 3000);
        if (orchState) {
            sections.push("### Orchestrator-State (.pi/orchestrator_state.md)", "", orchState, "");
        }

        // 3. Task-Status — Index einbetten (klein), Rest referenzieren
        const tasksContent = readIfExists(tasksIndex, 2500);
        if (tasksContent) {
            sections.push("### Aktive Tasks (.tasks/_index.md)", "", tasksContent, "");
        }

        // 4. Referenzen statt Inhalte
        sections.push("### Persistierte Quellen (bei Bedarf gezielt lesen)");
        if (fs.existsSync(memoryFile)) {
            sections.push("- `.pi/MEMORY.md` — Projektkontext, Struktur, Installation");
        }
        const decisions = listDirEntries(decisionsDir);
        if (decisions.length > 0) {
            sections.push(
                `- \`.pi/decisions/\` — ${decisions.length} Entscheidungs-Logs, neueste:`
            );
            for (const d of decisions.slice(-5)) sections.push(`  - ${d}`);
        }
        if (fs.existsSync(knowledgeIndex)) {
            sections.push("- `.pi/knowledge/INDEX.md` — gelernte Patterns, Architektur, Bugs");
        }
        sections.push("");

        // 5. File-Operationen aus der Preparation übernehmen (kumulativ, pi-Standard)
        const fileOps = preparation.fileOps;
        if (fileOps) {
            const readFiles: string[] = fileOps.readFiles ?? [];
            const modifiedFiles: string[] = fileOps.modifiedFiles ?? [];
            if (modifiedFiles.length > 0) {
                sections.push("<modified-files>");
                for (const f of modifiedFiles) sections.push(f);
                sections.push("</modified-files>", "");
            }
            if (readFiles.length > 0) {
                sections.push("<read-files>");
                for (const f of readFiles.slice(-30)) sections.push(f);
                sections.push("</read-files>", "");
            }
        }

        // 6. Verhaltensregel nach Compaction
        sections.push(
            "### Nach dieser Compaction",
            "1. Prüfe `.tasks/_index.md` für den aktuellen Schritt",
            "2. Arbeite am ersten `[ ]` unchecked Step weiter",
            "3. Lies referenzierte Files NUR wenn für den aktuellen Schritt nötig",
            `4. Compaction-Grund: ${reason === "overflow" ? "Context-Overflow (Request wird wiederholt)" : reason === "threshold" ? "Schwellwert erreicht" : "manuell"}`
        );

        const summary = sections.join("\n");

        // Notification im TUI
        try {
            ctx.ui?.notify?.(
                `Workflow-Compaction: ${Math.round((preparation.tokensBefore ?? 0) / 1000)}k → strukturierte Referenz-Summary`,
                "info"
            );
        } catch {
            // notify optional
        }

        return {
            compaction: {
                summary,
                firstKeptEntryId: preparation.firstKeptEntryId,
                tokensBefore: preparation.tokensBefore,
                details: {
                    type: "workflow-compaction",
                    readFiles: preparation.fileOps?.readFiles ?? [],
                    modifiedFiles: preparation.fileOps?.modifiedFiles ?? [],
                    sources: {
                        tasks: fs.existsSync(tasksIndex),
                        memory: fs.existsSync(memoryFile),
                        decisions: decisions.length,
                        orchestratorState: !!orchState,
                    },
                },
            },
        };
    });
}
