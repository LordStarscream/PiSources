/**
 * read-limit — kappt Tool-Output auf Infrastruktur-Ebene, damit ein einzelner
 * Turn nicht über eine Compaction-Schwelle springen kann, bevor pi (nur zwischen
 * Turns) überhaupt prüft.
 *
 * Zwei Mechanismen:
 *   1. read : `limit` VOR der Ausführung klemmen (tool_call, input ist mutable,
 *             keine Re-Validierung) → max. READ_LINES pro read.
 *   2. bash : Output NACH der Ausführung kappen (tool_result) → letzte BASH_LINES
 *             behalten, vollen Text nach /tmp spillen, damit der Agent bei echtem
 *             Bedarf nachlesen kann.
 *
 * Import-Specifier: pi.dev / earendil-works-Build nutzt @earendil-works/pi-coding-agent.
 * Auf dem @mariozechner/pi-coding-agent-Paket den Specifier unten tauschen —
 * es ist ein Type-only-Import, Runtime ist so oder so identisch (jiti strippt Typen).
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  isToolCallEventType,
  truncateTail,
  formatSize,
} from "@earendil-works/pi-coding-agent";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const READ_LINES = 300; // max. Zeilen pro `read`-Aufruf
const BASH_LINES = 100; // max. Zeilen pro `bash`-Ergebnis
const BASH_MAX_BYTES = 50_000; // Byte-Fallback (einzeilige Riesen-Outputs)

export default function (pi: ExtensionAPI) {
  // 1) READ: Zeilen-Limit vor Ausführung klemmen.
  pi.on("tool_call", async (event) => {
    if (isToolCallEventType("read", event)) {
      const requested = event.input.limit;
      event.input.limit = Math.min(requested ?? READ_LINES, READ_LINES);
    }
  });

  // 2) BASH: Output nach Ausführung kappen, vollen Text nach /tmp spillen.
  pi.on("tool_result", async (event) => {
    if (event.toolName !== "bash") return;

    const text = (event.content ?? [])
      .filter((b: any) => b?.type === "text")
      .map((b: any) => b.text as string)
      .join("\n");

    const trunc = truncateTail(text, {
      maxLines: BASH_LINES,
      maxBytes: BASH_MAX_BYTES,
    });
    if (!trunc.truncated) return; // nichts zu tun → Ergebnis unverändert

    const spill = join(tmpdir(), `pi-readlimit-${event.toolCallId}.txt`);
    try {
      writeFileSync(spill, text, "utf8");
    } catch {
      /* best effort — Spill ist optional */
    }

    const note =
      `\n\n[read-limit: zeige letzte ${trunc.outputLines} von ${trunc.totalLines} Zeilen ` +
      `(${formatSize(trunc.outputBytes)} von ${formatSize(trunc.totalBytes)}). ` +
      `Voller Output: ${spill} — bei Bedarf dort die früheren Zeilen lesen.]`;

    // Nur `content` patchen; `details`/`isError` bleiben unverändert (Middleware-Semantik).
    return { content: [{ type: "text", text: trunc.content + note }] };
  });
}
