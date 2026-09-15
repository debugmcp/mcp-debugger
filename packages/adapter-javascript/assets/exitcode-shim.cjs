/**
 * mcp-debugger exit-code shim (issue #247).
 *
 * vscode-js-debug never emits a DAP 'exited' event, so mcp-debugger cannot
 * learn the debuggee's exit code from the protocol. This preload (injected
 * via NODE_OPTIONS --require by the JavaScript adapter's launch transform)
 * records the exit code to a per-session temp file; the proxy worker reads
 * it when 'terminated' arrives and replays it as a synthesized 'exited'.
 *
 * Only the root debuggee writes: the shim claims the file via an env marker
 * that descendants (spawned children, worker_threads, cluster workers)
 * inherit, so wrappers like tsx — which propagate their child's exit code —
 * still record the correct value at the outermost process. The file variable
 * itself is then consumed (deleted from this process's env), so a descendant
 * that somehow loses the claim — a nested launch clears it deliberately —
 * still has no way to address the root's file (issue #731).
 *
 * Must never break the debuggee: every step is wrapped, and a missing file
 * variable makes the shim a no-op.
 */
(function () {
  try {
    var file = process.env.MCP_DEBUGGER_EXITCODE_FILE;
    if (!file) return;
    if (process.env.MCP_DEBUGGER_EXITCODE_CLAIMED === '1') return;
    process.env.MCP_DEBUGGER_EXITCODE_CLAIMED = '1';
    // Consumed: `file` is captured above, and descendants keep the claim but
    // inherit no path to write to.
    delete process.env.MCP_DEBUGGER_EXITCODE_FILE;
    var fs = require('fs');
    process.on('exit', function (code) {
      try {
        fs.writeFileSync(file, String(code));
      } catch (e) {
        /* never break the debuggee */
      }
    });
  } catch (e) {
    /* never break the debuggee */
  }
})();
