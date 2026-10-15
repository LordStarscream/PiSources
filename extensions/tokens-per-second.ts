/**
 * Tokens Per Second Extension
 *
 * Displays real-time tokens/second in the footer during streaming.
 * Counts text_delta and thinking_delta events as token proxies and
 * calculates a rolling TPS estimate with color-coded display.
 *
 * Subagent-Erweiterung (minimal-invasiv):
 * pi-subagents bindet Extensions in Kind-Sessions ein — jede Session
 * (main + jeder Subagent) bekommt eine EIGENE Instanz dieser Extension
 * mit eigenem ctx. Die Original-Logik bleibt daher unverändert und zählt
 * pro Session korrekt. Für die Gesamt-Anzeige teilen sich alle Instanzen
 * einen prozessweiten globalen Zähler (globalThis), den die main-Session
 * mit anzeigt wenn mehrere Streams parallel laufen.
 */

import type { ExtensionAPI, MessageUpdateEvent } from "@mariozechner/pi-coding-agent";

// ── Prozessweiter Shared State über alle Extension-Instanzen ──
interface SharedTps {
  streams: Map<number, { tokens: number; recent: number[] }>;
  nextId: number;
}
const G = globalThis as any;
if (!G.__tpsShared) {
  G.__tpsShared = { streams: new Map(), nextId: 1 } as SharedTps;
}
const shared: SharedTps = G.__tpsShared;

const ROLLING_WINDOW_MS = 3000; // 3-second rolling window

export default function (pi: ExtensionAPI) {
  // Eindeutige ID dieser Extension-Instanz (= dieser Session)
  const streamId = shared.nextId++;

  // State for tracking streaming performance (Original, unverändert)
  let startTime = 0;
  let tokenCount = 0;
  let displayTimer: ReturnType<typeof setInterval> | null = null;

  // Recent token timestamps for rolling window TPS
  const recentTokens: number[] = [];

  pi.on("message_start", async (event, ctx) => {
    if (event.message.role !== "assistant") return;

    // Reset for this message
    startTime = Date.now();
    tokenCount = 0;
    recentTokens.length = 0;

    // Im Shared State registrieren
    shared.streams.set(streamId, { tokens: 0, recent: recentTokens });

    // Periodic display refresh
    if (displayTimer) clearInterval(displayTimer);
    displayTimer = setInterval(() => {
      updateDisplay(ctx);
    }, 300);
  });

  pi.on("message_update", async (event, ctx) => {
    if (event.message.role !== "assistant") return;

    const aev = event.assistantMessageEvent;

    // Count actual token deltas
    if (aev.type === "text_delta" || aev.type === "thinking_delta") {
      tokenCount++;
      const now = Date.now();
      recentTokens.push(now);

      // Prune old entries outside the rolling window
      const cutoff = now - ROLLING_WINDOW_MS;
      while (recentTokens.length > 0 && recentTokens[0]! < cutoff) {
        recentTokens.shift();
      }

      // Shared State aktualisieren
      const entry = shared.streams.get(streamId);
      if (entry) entry.tokens = tokenCount;
    }

    updateDisplay(ctx);
  });

  pi.on("message_end", async (event, ctx) => {
    if (event.message.role !== "assistant") return;

    // Stop periodic updates
    stopDisplay();

    // Aus dem Shared State austragen
    shared.streams.delete(streamId);

    // Show final stats
    const elapsed = (Date.now() - startTime) / 1000;
    if (elapsed > 0 && tokenCount > 0) {
      const tps = tokenCount / elapsed;
      const theme = ctx.ui.theme;
      const check = theme.fg("success", "✓");
      const tpsStr = theme.fg("success", `${tps.toFixed(1)} tok/s`);
      ctx.ui.setStatus(
        "tps",
        `${check} ${tokenCount} tokens in ${elapsed.toFixed(1)}s — ${tpsStr}`,
      );
    }

    startTime = 0;
    tokenCount = 0;
    recentTokens.length = 0;
  });

  pi.on("session_shutdown", async () => {
    stopDisplay();
    shared.streams.delete(streamId);
  });

  function stopDisplay() {
    if (displayTimer) {
      clearInterval(displayTimer);
      displayTimer = null;
    }
  }

  function updateDisplay(ctx: any) {
    if (!startTime || tokenCount <= 0) return;

    const now = Date.now();
    const elapsed = (now - startTime) / 1000;

    // Calculate rolling TPS from recent tokens in the window (Original)
    let rollingTps: number;
    if (recentTokens.length >= 2) {
      const windowMs = now - recentTokens[0]!;
      rollingTps = ((recentTokens.length - 1) / (windowMs / 1000));
    } else {
      rollingTps = tokenCount / elapsed;
    }

    // Overall average TPS
    const avgTps = tokenCount / elapsed;

    // ── Subagent-Erweiterung: Gesamt-TPS über alle aktiven Streams ──
    let combinedTps = 0;
    let activeCount = 0;
    for (const [, s] of shared.streams) {
      // rolling TPS je Stream aus dessen recent-Fenster
      if (s.recent.length >= 2) {
        const wMs = now - s.recent[0]!;
        if (wMs > 0) combinedTps += (s.recent.length - 1) / (wMs / 1000);
      }
      activeCount++;
    }

    const theme = ctx.ui.theme;
    const spinner = theme.fg("accent", "◉");

    // Color based on rolling TPS
    let color: "success" | "text" | "warning" | "error" = "text";
    if (rollingTps >= 50) color = "success";
    else if (rollingTps >= 15) color = "text";
    else if (rollingTps >= 5) color = "warning";
    else color = "error";

    const tpsStr = theme.fg(color, `${rollingTps.toFixed(1)} tok/s`);
    const avgStr = theme.fg("dim", ` [avg: ${avgTps.toFixed(1)}]`);
    const countStr = theme.fg("dim", ` (${tokenCount})`);

    // Zusatz nur wenn mehrere Streams parallel laufen
    const combinedStr =
      activeCount > 1
        ? theme.fg("accent", ` | Σ ${combinedTps.toFixed(1)} tok/s ×${activeCount}`)
        : "";

    ctx.ui.setStatus("tps", `${spinner} ${tpsStr}${avgStr}${countStr}${combinedStr}`);
  }
}
