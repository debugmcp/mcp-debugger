/**
 * Attach target for the JavaScript function-breakpoint smoke test (issue #295).
 *
 * Started as: node --inspect=127.0.0.1:<port> function_bp_attach_target.js
 * Exposes tick on globalThis so a function breakpoint can resolve via global
 * evaluation while the target is running (attach mode has no entry pause).
 */
let counter = 0;

globalThis.tick = function tick() {
  counter += 1;
  if (counter % 10 === 0) {
    console.log('tick', counter);
  }
};

setInterval(() => globalThis.tick(), 100);
console.log('function bp attach target started');
