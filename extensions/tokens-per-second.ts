/**
 * Tokens Per Second Extension
 *
 * Displays real-time tokens/second in the footer during streaming.
 * Counts text_delta and thinking_delta events as token proxies and
 * calculates a rolling TPS estimate with color-coded display.
 */

import type { ExtensionAPI, MessageUpdateEvent } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // State for tracking streaming performance
  let startTime = 0;
  let tokenCount = 0;
  let displayTimer: ReturnType<typeof setInterval> | null = null;

  // Recent token timestamps for rolling window TPS
  const recentTokens: number[] = [];
  const ROLLING_WINDOW_MS = 3000; // 3-second rolling window

  pi.on("message_start", async (event, ctx) => {
    if (event.message.role !== "assistant") return;

    // Reset for this message
    startTime = Date.now();
    tokenCount = 0;
    recentTokens.length = 0;

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
    }

    updateDisplay(ctx);
  });

  pi.on("message_end", async (event, ctx) => {
    if (event.message.role !== "assistant") return;

    // Stop periodic updates
    stopDisplay();

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

    // Calculate rolling TPS from recent tokens in the window
    let rollingTps: number;
    if (recentTokens.length >= 2) {
      const windowMs = now - recentTokens[0]!;
      rollingTps = ((recentTokens.length - 1) / (windowMs / 1000));
    } else {
      rollingTps = tokenCount / elapsed;
    }

    // Overall average TPS
    const avgTps = tokenCount / elapsed;

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

    ctx.ui.setStatus("tps", `${spinner} ${tpsStr}${avgStr}${countStr}`);
  }
}
