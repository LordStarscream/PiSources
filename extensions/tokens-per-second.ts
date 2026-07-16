/**
 * Tokens Per Second Extension (mit Subagent-Support)
 *
 * Displays real-time tokens/second in the footer during streaming.
 * Counts text_delta and thinking_delta events as token proxies and
 * calculates a rolling TPS estimate with color-coded display.
 *
 * Subagent-Erweiterung:
 * pi-subagents bindet Extensions in die Kind-Sessions ein (bindExtensions),
 * daher feuern message_start/update/end auch für Subagenten — nur mit einem
 * anderen `ctx`-Objekt pro Session. Wir verfolgen jeden Stream unabhängig
 * über eine stabile ID, die einmalig pro `ctx`-Objekt vergeben wird
 * (WeakMap<ctx, id>), und halten die eigentlichen Stream-Daten in einer
 * iterierbaren Map<id, StreamState>.
 *
 * Anzeige:
 *   - Combined-Status ("tps:combined"): Summe aller aktiven Streams (main + subagents)
 *   - Pro-Stream-Status ("tps:<id>"): jeder Stream einzeln, gelabelt (main / sub-agent N)
 *
 * Falls pi-subagents keine erkennbaren Unterscheidungsmerkmale im ctx liefert,
 * werden Streams schlicht in Erscheinungsreihenfolge als "main", "sub-agent 1", …
 * gelabelt — das ist ausreichend robust, da wir nicht auf interne Feldnamen
 * von pi-subagents angewiesen sind.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const ROLLING_WINDOW_MS = 3000; // 3-second rolling window
const DISPLAY_INTERVAL_MS = 300;

interface StreamState {
    id: string;
    label: string;
    startTime: number;
    tokenCount: number;
    recentTokens: number[];
    active: boolean;
}

export default function (pi: ExtensionAPI) {
    // ctx-Objekt → stabile Stream-ID (überlebt mehrere Turns derselben Session)
    const ctxToId = new WeakMap<object, string>();
    // Stream-ID → Live-State (iterierbar für die Aggregat-Anzeige)
    const streams = new Map<string, StreamState>();

    let nextSubagentIndex = 1;
    let mainAssigned = false;
    let displayTimer: ReturnType<typeof setInterval> | null = null;

    function getOrCreateStream(ctx: any): StreamState {
        let id = ctxToId.get(ctx);
        if (!id) {
            // Erstes Mal, dass wir dieses ctx-Objekt sehen → neuer Stream.
            // Grobe Heuristik für Subagent-Erkennung: pi-subagents könnte
            // (je nach Version) ein Feld wie ctx.isSubagent / ctx.agentType /
            // ctx.sessionManager?.parentSessionId setzen. Wir prüfen mehrere
            // Kandidaten defensiv, ohne uns darauf zu verlassen.
            const looksLikeSubagent =
                Boolean(ctx?.isSubagent) ||
                Boolean(ctx?.agentType) ||
                Boolean(ctx?.sessionManager?.parentSessionId) ||
                Boolean(ctx?.parentSessionId);

            if (!mainAssigned && !looksLikeSubagent) {
                id = "main";
                mainAssigned = true;
            } else {
                const suffix = ctx?.agentType ? `:${ctx.agentType}` : "";
                id = `sub-${nextSubagentIndex}${suffix}`;
                nextSubagentIndex++;
            }
            ctxToId.set(ctx, id);
        }

        let state = streams.get(id);
        if (!state) {
            const label =
                id === "main"
                    ? "main"
                    : id.startsWith("sub-")
                        ? `sub-agent ${id.replace("sub-", "")}`
                        : id;
            state = {
                id,
                label,
                startTime: 0,
                tokenCount: 0,
                recentTokens: [],
                active: false,
            };
            streams.set(id, state);
        }
        return state;
    }

    function ensureDisplayTimer(ctx: any) {
        if (displayTimer) return;
        displayTimer = setInterval(() => updateDisplay(ctx), DISPLAY_INTERVAL_MS);
    }

    function stopDisplayTimerIfIdle() {
        const anyActive = Array.from(streams.values()).some((s) => s.active);
        if (!anyActive && displayTimer) {
            clearInterval(displayTimer);
            displayTimer = null;
        }
    }

    pi.on("message_start", async (event, ctx) => {
        if (event.message.role !== "assistant") return;

        const stream = getOrCreateStream(ctx);
        stream.startTime = Date.now();
        stream.tokenCount = 0;
        stream.recentTokens.length = 0;
        stream.active = true;

        ensureDisplayTimer(ctx);
    });

    pi.on("message_update", async (event, ctx) => {
        if (event.message.role !== "assistant") return;

        const stream = getOrCreateStream(ctx);
        const aev = event.assistantMessageEvent;

        if (aev.type === "text_delta" || aev.type === "thinking_delta") {
            stream.tokenCount++;
            const now = Date.now();
            stream.recentTokens.push(now);

            const cutoff = now - ROLLING_WINDOW_MS;
            while (stream.recentTokens.length > 0 && stream.recentTokens[0]! < cutoff) {
                stream.recentTokens.shift();
            }
        }

        updateDisplay(ctx);
    });

    pi.on("message_end", async (event, ctx) => {
        if (event.message.role !== "assistant") return;

        const stream = getOrCreateStream(ctx);
        stream.active = false;

        const elapsed = (Date.now() - stream.startTime) / 1000;
        if (elapsed > 0 && stream.tokenCount > 0) {
            const tps = stream.tokenCount / elapsed;
            const theme = ctx.ui.theme;
            const check = theme.fg("success", "✓");
            const tpsStr = theme.fg("success", `${tps.toFixed(1)} tok/s`);
            const labelStr = stream.id === "main" ? "" : theme.fg("dim", `[${stream.label}] `);
            ctx.ui.setStatus(
                `tps:${stream.id}`,
                `${labelStr}${check} ${stream.tokenCount} tokens in ${elapsed.toFixed(1)}s — ${tpsStr}`,
            );
        }

        stream.startTime = 0;
        stream.tokenCount = 0;
        stream.recentTokens.length = 0;

        updateCombinedDisplay(ctx);
        stopDisplayTimerIfIdle();
    });

    pi.on("session_shutdown", async (_event, ctx) => {
        const id = ctxToId.get(ctx as object);
        if (id) {
            streams.delete(id);
            ctxToId.delete(ctx as object);
        }
        stopDisplayTimerIfIdle();
    });

    function rollingTpsFor(stream: StreamState): number {
        const now = Date.now();
        const elapsed = (now - stream.startTime) / 1000;
        if (stream.recentTokens.length >= 2) {
            const windowMs = now - stream.recentTokens[0]!;
            return (stream.recentTokens.length - 1) / (windowMs / 1000);
        }
        return elapsed > 0 ? stream.tokenCount / elapsed : 0;
    }

    function colorFor(tps: number): "success" | "text" | "warning" | "error" {
        if (tps >= 50) return "success";
        if (tps >= 15) return "text";
        if (tps >= 5) return "warning";
        return "error";
    }

    function updateDisplay(ctx: any) {
        const theme = ctx.ui.theme;
        const activeStreams = Array.from(streams.values()).filter((s) => s.active && s.startTime > 0);

        if (activeStreams.length === 0) return;

        // Pro-Stream-Anzeige
        for (const stream of activeStreams) {
            const rollingTps = rollingTpsFor(stream);
            const elapsed = (Date.now() - stream.startTime) / 1000;
            const avgTps = elapsed > 0 ? stream.tokenCount / elapsed : 0;

            const spinner = theme.fg("accent", "◉");
            const color = colorFor(rollingTps);
            const tpsStr = theme.fg(color, `${rollingTps.toFixed(1)} tok/s`);
            const avgStr = theme.fg("dim", ` [avg: ${avgTps.toFixed(1)}]`);
            const countStr = theme.fg("dim", ` (${stream.tokenCount})`);
            const labelStr = stream.id === "main" ? "" : theme.fg("dim", `[${stream.label}] `);

            ctx.ui.setStatus(`tps:${stream.id}`, `${labelStr}${spinner} ${tpsStr}${avgStr}${countStr}`);
        }

        updateCombinedDisplay(ctx, activeStreams);
    }

    function updateCombinedDisplay(ctx: any, activeStreamsIn?: StreamState[]) {
        const theme = ctx.ui.theme;
        const activeStreams =
            activeStreamsIn ?? Array.from(streams.values()).filter((s) => s.active && s.startTime > 0);

        // Nur anzeigen wenn mehr als ein Stream gleichzeitig läuft (main + subagents)
        if (activeStreams.length <= 1) {
            // Kein paralleles Geschehen — Combined-Status ausblenden
            ctx.ui.setStatus("tps:combined", "");
            return;
        }

        const combinedTps = activeStreams.reduce((sum, s) => sum + rollingTpsFor(s), 0);
        const combinedTokens = activeStreams.reduce((sum, s) => sum + s.tokenCount, 0);

        const spinner = theme.fg("accent", "⚡");
        const color = colorFor(combinedTps);
        const tpsStr = theme.fg(color, `${combinedTps.toFixed(1)} tok/s combined`);
        const countStr = theme.fg("dim", ` (${activeStreams.length} streams, ${combinedTokens} tok)`);

        ctx.ui.setStatus("tps:combined", `${spinner} ${tpsStr}${countStr}`);
    }
}
