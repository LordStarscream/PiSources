/**
 * auto-continue — wenn ein Turn durch das Output-Token-Limit abgeschnitten wird
 * und der Agent daraufhin idle geht (auf Eingabe wartet), schickt diese Extension
 * automatisch eine Fortsetzungs-Nachricht, statt dass du "weiter" tippen musst.
 *
 * Bewusste Grenzen (aus den heutigen Lehren):
 * - Feuert NUR bei Output-Limit-Abbruch (stopReason length/max_tokens), nicht bei
 *   normalem Turn-Ende oder User-Abbruch (Esc/stop).
 * - Harte Obergrenze MAX_CONSECUTIVE: nach N Fortsetzungen HINTEREINANDER (ohne
 *   sauberes Turn-Ende dazwischen) wird gestoppt und du wirst benachrichtigt. Das
 *   verhindert Endlos-Schleifen bei Runaway-Generierung (z.B. ein Datei-Rewrite,
 *   der immer wieder ans Limit läuft) — und macht genau die sichtbar.
 * - Der Fortsetzungs-Prompt ist streng gegen Drift: KEINE neue Aufgabe, nichts
 *   wiederholen, Tool-Call vollständig neu ausgeben. Ein nacktes "weiter" lässt
 *   das Modell erfahrungsgemäß in einen anderen Schritt springen (z.B. vom Planen
 *   ins Implementieren).
 *
 * Import-Specifier ggf. auf @mariozechner/pi-coding-agent tauschen (Type-only).
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Nach wie vielen Output-Limits HINTEREINANDER NICHT mehr automatisch fortsetzen.
const MAX_CONSECUTIVE = 3;

// stopReason-Werte, die ein Output-Token-Limit anzeigen (case-insensitive).
// llama.cpp liefert typischerweise "length". Falls dein pi einen anderen Wert
// normalisiert: die Verifizierungs-Zeile unten einmal einkommentieren, echten
// Wert ablesen und hier ergänzen.
const OUTPUT_LIMIT_REASONS = ["length", "max_tokens", "maxtokens", "output_limit"];

const CONTINUE_PROMPT =
  "Deine letzte Antwort wurde durch das Output-Token-Limit abgeschnitten. " +
  "Setze EXAKT an der abgeschnittenen Stelle fort. Beginne KEINE neue Aufgabe und " +
  "wechsle NICHT zu einem anderen Schritt. Wiederhole nichts, was du bereits " +
  "ausgegeben hast. Falls du mitten in einem Tool-Call warst, gib diesen Tool-Call " +
  "vollständig und mit kompletten Argumenten neu aus.";

export default function (pi: ExtensionAPI) {
  let consecutive = 0;
  let lastStopReason = "";

  // Stop-Grund jedes Turns merken (turn_end liefert die Assistant-Message).
  pi.on("turn_end", async (event) => {
    const msg = (event as any).message;
    lastStopReason = String(msg?.stopReason ?? msg?.finishReason ?? "").toLowerCase();
  });

  // Wenn der Agent idle geht: bei Output-Limit automatisch fortsetzen.
  pi.on("agent_end", async (_event, ctx) => {
    // Zum Verifizieren des echten stopReason-Werts einmal einkommentieren:
    // ctx.ui.notify(`agent_end stopReason: "${lastStopReason}"`, "info");

    const hitLimit = OUTPUT_LIMIT_REASONS.includes(lastStopReason);

    if (!hitLimit) {
      consecutive = 0; // sauberes Ende → Zähler zurücksetzen
      return;
    }

    if (consecutive >= MAX_CONSECUTIVE) {
      consecutive = 0;
      ctx.ui.notify(
        `${MAX_CONSECUTIVE}× Output-Limit hintereinander — ich setze NICHT automatisch fort. ` +
          `Wahrscheinlich eine Runaway-Generierung (z.B. Datei-Rewrite statt gezieltem Patch). ` +
          `Prüf, ob der Agent zu groß schreibt, und steuere manuell.`,
        "warning",
      );
      return;
    }

    consecutive++;
    ctx.ui.notify(
      `Output-Limit — setze automatisch fort (${consecutive}/${MAX_CONSECUTIVE}).`,
      "info",
    );
    pi.sendUserMessage(CONTINUE_PROMPT);
  });
}
