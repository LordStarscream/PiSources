/**
 * compaction-metrics — passiver Beobachter, der jede Compaction zählt und
 * protokolliert, um "wie oft ballooned ein Turn?" messbar zu machen.
 *
 * Kernmetrik: reason === "overflow" = ein Turn ist über das Fenster gewachsen und
 * wurde erst am Turn-Ende abgefangen (das, was read-limit verhindern soll).
 * "threshold" = proaktive, gesunde Compaction. "manual" = /compact.
 * tokensBefore bei overflow = "wie groß wurde der Ballon".
 *
 * ANZEIGE: eigenes belowEditor-Widget statt setStatus — so bekommt der Zähler eine
 * eigene Zeile und teilt sie sich NICHT mehr mit pis tok/s-Working-Indicator
 * (setStatus rendert vor dem Indicator, ohne Reihenfolge-Kontrolle).
 *
 * Der Handler greift NICHT ein: gibt nichts zurück und fängt alle Fehler.
 * Import-Specifier ggf. auf @mariozechner/pi-coding-agent tauschen (Type-only).
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { appendFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

// Projekt-lokal. Für EINEN aggregierten Log über mehrere Projekte hinweg hier
// einen absoluten Pfad hardcoden (z.B. ~/.pi/agent/compaction-metrics.jsonl).
const LOG_PATH = join(process.cwd(), ".pi", "compaction-metrics.jsonl");
const WIDGET_KEY = "compact-metrics";
const REPORT_KEY = "compact-metrics-report";

export default function (pi: ExtensionAPI) {
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const counts: Record<string, number> = { threshold: 0, overflow: 0, manual: 0 };
  let retries = 0;

  const line = () =>
    `compact: t${counts.threshold} o${counts.overflow} m${counts.manual} (retry ${retries})`;

  // eigene Zeile UNTER dem Editor — nicht in der tok/s-Status-Zeile
  const showCounter = (ctx: any) =>
    ctx.ui.setWidget(WIDGET_KEY, [line()], { placement: "belowEditor" });

  pi.on("session_start", async (_event, ctx) => {
    try {
      mkdirSync(dirname(LOG_PATH), { recursive: true });
    } catch {
      /* egal */
    }
    showCounter(ctx); // bestätigt: Listener lebt (t0 o0 m0)
  });

  pi.on("session_before_compact", async (event, ctx) => {
    try {
      const reason: string = (event as any).reason ?? "unknown";
      const willRetry = !!(event as any).willRetry;
      const tokensBefore: number | undefined = (event as any).preparation?.tokensBefore;

      counts[reason] = (counts[reason] ?? 0) + 1;
      if (willRetry) retries++;

      appendFileSync(
        LOG_PATH,
        JSON.stringify({
          ts: new Date().toISOString(),
          runId,
          reason,
          willRetry,
          tokensBefore,
        }) + "\n",
        "utf8",
      );
      showCounter(ctx);
    } catch {
      /* Beobachter darf die Compaction NIE stören */
    }
    // kein return → nicht canceln, Summary nicht überschreiben
  });

  pi.registerCommand("compaction-stats", {
    description: "Compaction-Zähler dieses Laufs + overflow-tokensBefore-Statistik",
    handler: async (_args, ctx) => {
      const lines = [
        `Run ${runId}`,
        `threshold ${counts.threshold}  ·  overflow ${counts.overflow}  ·  manual ${counts.manual}  ·  retries ${retries}`,
      ];
      try {
        if (existsSync(LOG_PATH)) {
          const vals = readFileSync(LOG_PATH, "utf8")
            .trim()
            .split("\n")
            .map((l) => {
              try {
                return JSON.parse(l);
              } catch {
                return null;
              }
            })
            .filter(
              (r: any) =>
                r &&
                r.runId === runId &&
                r.reason === "overflow" &&
                typeof r.tokensBefore === "number",
            )
            .map((r: any) => r.tokensBefore as number);
          if (vals.length) {
            const max = Math.max(...vals);
            const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
            lines.push(`overflow tokensBefore — avg ${avg}, max ${max} (n=${vals.length})`);
          }
        }
      } catch {
        /* egal */
      }
      lines.push(`log: ${LOG_PATH}`);
      // Detail-Report als eigenes Widget (aboveEditor), stört den Zähler nicht
      ctx.ui.setWidget(REPORT_KEY, lines);
    },
  });
}
