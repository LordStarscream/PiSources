// ~/.pi/agent/extensions/pi-file-locks/index.ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // agentId -> Set<filePath>
  const locksByAgent = new Map<string, Set<string>>();
  // filePath -> agentId (wer hält gerade die Datei)
  const lockOwner = new Map<string, string>();

  // --- Lifecycle: Locks automatisch aufräumen ---
  // pi-subagents feuert diese Events dokumentiert über pi.events:
  // subagents:created, started, completed, failed, steered, compacted
  pi.events.on("subagents:completed", (e: any) => releaseAll(e.id ?? e.agentId));
  pi.events.on("subagents:failed", (e: any) => releaseAll(e.id ?? e.agentId));

  function releaseAll(agentId: string) {
    const files = locksByAgent.get(agentId);
    if (!files) return;
    for (const f of files) {
      if (lockOwner.get(f) === agentId) lockOwner.delete(f);
    }
    locksByAgent.delete(agentId);
  }

  // --- Enforcement: write/edit blockieren, wenn Datei fremd reserviert ist ---
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "write" && event.toolName !== "edit") return;

    const path = event.input.path as string;
    // TODO: exakten Feldnamen für die aktuelle Agent-/Session-ID verifizieren
    // (siehe Schritt 3 – nach Installation lokal in den .d.ts nachschauen)
    const currentAgentId = ctx.sessionManager?.getCurrentSession?.()?.id ?? "main";

    const holder = lockOwner.get(path);
    if (holder && holder !== currentAgentId) {
      return { block: true, reason: `Datei ${path} ist von Agent ${holder} reserviert` };
    }
  });

  // --- Reservierung bei Agent-Start automatisch anlegen ---
  pi.events.on("subagents:created", (e: any) => {
    locksByAgent.set(e.id, new Set());
  });

  // --- Manuelles Reservierungs-Tool für den Orchestrator ---
  pi.registerTool({
    name: "reserve_files",
    label: "Reserve Files",
    description: "Reserviert Dateien für den aktuellen Agenten, bevor Sub-Agenten gespawnt werden",
    parameters: {
      type: "object",
      properties: { paths: { type: "array", items: { type: "string" } } },
      required: ["paths"],
    } as any,
    async execute(toolCallId, params: any, signal, onUpdate, ctx) {
      const agentId = ctx?.sessionManager?.getCurrentSession?.()?.id ?? "main";
      const conflicts = params.paths.filter((p: string) => lockOwner.has(p) && lockOwner.get(p) !== agentId);
      if (conflicts.length) {
        return { content: [{ type: "text", text: `Konflikt bei: ${conflicts.join(", ")}` }], details: {} };
      }
      for (const p of params.paths) {
        lockOwner.set(p, agentId);
        if (!locksByAgent.has(agentId)) locksByAgent.set(agentId, new Set());
        locksByAgent.get(agentId)!.add(p);
      }
      return { content: [{ type: "text", text: `Reserviert: ${params.paths.join(", ")}` }], details: {} };
    },
  });
}
