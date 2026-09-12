import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// NOTE: pi's extension contract requires this default export (the factory
// pi executes at load) — an intentional divergence from the repo's
// no-default-exports convention, which covers server sources only.

const HINT =
  'mcp-debugger: step-through debugging tools are reachable via mcp({ search: "breakpoint" }) (pi-mcp-adapter, lazy start); workflow skill: /skill:mcp-debugger';

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    ctx.ui.notify(HINT, "info");
  });
}
