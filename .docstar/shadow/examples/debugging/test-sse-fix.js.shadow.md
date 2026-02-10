# examples/debugging/test-sse-fix.js
@source-hash: a69826185c4e17f3
@generated: 2026-02-09T18:14:46Z

## Purpose
Simple debugging test script designed for setting breakpoints and testing debugging workflows. Part of SSE (Server-Sent Events) debugging examples.

## Key Functions
- **testFunction()** (L2-8): Basic arithmetic function that adds two hardcoded values (10 + 20), with an intentional breakpoint location at line 5. Returns the sum and logs intermediate result.

## Execution Flow
- Function invocation (L11): Calls testFunction() and stores result
- Output logging (L12): Displays final result to console

## Dependencies
- Native JavaScript console API for logging

## Architectural Notes
- Minimal test case structure optimized for debugging tools
- Hardcoded values ensure predictable execution paths
- Strategic breakpoint comment (L5) indicates intended debugging workflow
- No error handling or complex logic - designed for clean debugging experience