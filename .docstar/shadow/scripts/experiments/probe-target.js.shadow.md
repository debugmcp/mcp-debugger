# scripts/experiments/probe-target.js
@source-hash: 7bc2b07b98e87ecc
@generated: 2026-02-10T01:18:52Z

## Purpose
Test target script for debugging DAP (Debug Adapter Protocol) behavior validation. Designed to provide reliable debugging points and keep process alive for debugger attachment/adoption scenarios.

## Key Components

**Debugging Hooks:**
- `debugger` statement (L11) - Forces immediate breakpoint regardless of binding state
- `probeVar` constant (L13) - Primary breakpoint target line for testing
- Console logging (L9, L20) - Execution state markers

**Functions:**
- `add(a, b)` (L15-17) - Simple arithmetic function for step-through testing

**Process Management:**
- `setTimeout` callback (L19-21) - Delayed execution with computation
- `setInterval` keep-alive (L24) - Prevents process termination for reliable debugger attachment

## Architecture & Patterns
- Minimal test harness design optimized for debugger stability testing
- Sequential execution flow with predictable timing (500ms delay)
- Explicit process lifecycle management for external debugger tools

## Usage Context
Intended for use with `--line 13` parameter when running debugging probes. The 500ms timeout allows debugger attachment window, while the infinite interval ensures the process remains available for adoption scenarios.

## Dependencies
- Node.js runtime (uses `setTimeout`, `setInterval`, `console`)
- No external modules required