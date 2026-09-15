// Runs before the bundled CLI. Report after main() has started, even when
// Commander handles --version by calling process.exit().
process.on('exit', () => {
  process.stderr.write(`bootstrap-env:${JSON.stringify({ skipAutoStart: process.env.DEBUG_MCP_SKIP_AUTO_START })}\n`);
});
