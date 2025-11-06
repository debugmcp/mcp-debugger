'use strict';

// Probe target used to stabilize js-debug DAP behavior for the standalone probe.
// Guarantees:
// - Early debugger statement to force a stop
// - A simple line breakpoint target
// - Keeps the process alive long enough for attach/adoption

console.log('probe-target start');

debugger; // Force an early stop regardless of breakpoint binding

const probeVar = 123; // Suggested breakpoint line (use --line 6 when running the probe)

function add(a, b) {
  return a + b;
}

setTimeout(() => {
  console.log('ready', add(probeVar, 1));
}, 500);

// Keep the event loop alive so the adapter can attach/adopt reliably
setInterval(() => {}, 1000);
