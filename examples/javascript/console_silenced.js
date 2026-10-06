// A program that owns its stdout: console.log is replaced with a no-op, the
// way an MCP stdio server (mcp-debugger itself) protects its protocol stream.
// Drives the JavaScript logpoint e2e for issues #850/#861/#853 — a logpoint
// on the hot line must reach get_output even though console.log is gone.
console.log = () => {};
let a = 0;
const o = { k: 2 };
for (let i = 0; i < 3; i++) {
  a += 1; // LOGPOINT_LINE
}
process.stdout.write(`silenced: a=${a}\n`);
