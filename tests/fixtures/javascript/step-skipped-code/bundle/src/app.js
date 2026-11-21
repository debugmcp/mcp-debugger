// The program, bundled with its dependency into out/bundle.js (one V8 script, one source map).
const { libWork, libCall } = require('blib');
function mine(v) {
  const w = v * 3; // B-IN-MINE
  return w; // B-MINE-RETURN
}
function run() {
  const a = libWork(1); // B-CALLS-LIBWORK
  const b = a + 1; // B-AFTER-LIBWORK
  const c = mine(b); // B-CALLS-MINE
  const d = c + 1; // B-AFTER-MINE
  const e = libCall(mine); // B-CALLS-LIBCALL
  const f = e + 1; // B-AFTER-LIBCALL
  return f; // B-RUN-RETURN
}
const out = run(); // B-CALLS-RUN
console.log('bundle done', out); // B-END
