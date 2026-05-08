/**
 * Pi Extension Factory Function for Safety Guard
 * @param {import('@mariozechner/pi-coding-agent').ExtensionAPI} pi
 */
module.exports = function(pi) {
  // Safety Guard Extension for Pi
  // Intercepts tool calls to enforce safety policies

  pi.on("tool_call", async (event, ctx) => {
    const toolName = event.toolName;
    const input = event.input || {};

    // Define dangerous operations
    const dangerousPatterns = [
      { command: /rm -rf\s+\/(?!\s*$)/, message: "Blocked recursive root deletion" },
      { command: /sudo\s+rm/, message: "Blocked sudo rm operations" },
    ];

    if (toolName === "bash" && input.command) {
      for (const pattern of dangerousPatterns) {
        if (pattern.command.test(input.command)) {
          ctx.ui.notify(`Safety Guard Blocked: ${pattern.message}`, "error");
          return { block: true, reason: pattern.message };
        }
      }
    }
  });

  // Example: Register a custom safety status tool
  pi.registerTool({
    name: "safety_status",
    label: "Safety Status",
    description: "Check the current safety guard status",
    execute: async () => {
      return {
        content: [{ type: "text", text: "Safety Guard is active and monitoring tool calls." }],
        details: {},
      };
    },
  });
};
