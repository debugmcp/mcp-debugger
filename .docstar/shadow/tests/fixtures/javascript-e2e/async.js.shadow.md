# tests/fixtures/javascript-e2e/async.js
@source-hash: cdc98904a4726854
@generated: 2026-02-09T18:14:32Z

## Purpose
JavaScript E2E test fixture for async/await debugging scenarios. Provides a minimal async execution flow with deliberate breakpoint markers for debugger testing.

## Key Components
- **delay function (L4-6)**: Promise-based utility that creates artificial delays using setTimeout
- **main async function (L8-14)**: Primary test scenario demonstrating async/await flow with:
  - Variable initialization (x=41, L10)
  - Async delay operation (10ms, L11) 
  - Computation after await (y=x+1, L12)
  - Debug breakpoint marker comment "BREAK_HERE" (L12)
- **Error handling (L16-19)**: Top-level catch block that logs errors and exits process

## Architecture & Patterns
- **ESM-compatible**: Structured as plain script without module exports/imports
- **Promise-based async**: Uses native Promise/async-await rather than callbacks
- **Self-executing**: Immediately invokes main() with error boundary
- **Process lifecycle management**: Explicit process.exit(1) on error

## Testing Context
- **Breakpoint targeting**: L12 marked as debug break location
- **Minimal complexity**: Simple linear flow ideal for step-debugging validation
- **Console output**: Provides observable checkpoints ("async start", "async sum")

## Dependencies
- Node.js runtime (process.exit)
- Native Promise/setTimeout APIs