# tests/fixtures/javascript-e2e/simple.js
@source-hash: 3ac05051f3c7f338
@generated: 2026-02-09T18:14:30Z

## Purpose
E2E testing fixture for debugging JavaScript execution with ESM compatibility. Designed as a minimal script to test debugging breakpoints and async behavior.

## Key Elements
- **Main execution flow (L4-10)**: Simple sequential script that logs start, performs async delay, hits debugger breakpoint, then completes computation
- **Async delay (L7)**: 1-second timeout using Promise-based setTimeout for testing async debugging scenarios
- **Debug breakpoint (L8)**: Explicit debugger statement marked with "BREAK_HERE" comment for E2E test coordination
- **ESM compatibility (L12)**: Empty export statement to prevent import errors if accidentally imported as module

## Architecture
- Top-level async script (uses await at module level)
- ESM-friendly structure with export fallback
- Minimal dependencies (only built-in Promise/setTimeout)

## Critical Constraints
- Requires ESM-compatible environment for top-level await
- Debugger statement must be preserved for E2E test functionality
- 1-second delay is intentional for testing async debugging flows