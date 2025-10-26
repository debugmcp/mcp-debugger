#!/usr/bin/env node
/**
 * Simple JavaScript test script for MCP debugger smoke tests.
 *
 * Mirrors the Python sample so end-to-end tests can validate breakpoint,
 * stepping, and variable inspection behavior for the JavaScript adapter.
 */
export function main() {
  let a = 1;
  let b = 2;
  console.log(`Before swap: a=${a}, b=${b}`);

  // Set the breakpoint on the next line so variables are still in their initial state.
  [a, b] = [b, a];
  console.log(`After swap: a=${a}, b=${b}`);
}

main();
