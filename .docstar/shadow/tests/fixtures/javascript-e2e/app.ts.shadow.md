# tests/fixtures/javascript-e2e/app.ts
@source-hash: 1cd6846134d9b5e0
@generated: 2026-02-10T00:41:22Z

## Purpose
E2E testing fixture for debugging TypeScript applications with source maps. Provides a minimal TypeScript program with a designated breakpoint location for testing debugging capabilities.

## Key Elements
- **greeting variable** (L2): String literal constant `'hello world'` with explicit type annotation
- **shout variable** (L3): Derived uppercase transformation with `// BREAK_HERE` comment indicating designated breakpoint location
- **Console output** (L4): Simple logging of the transformed string

## Dependencies
- TypeScript compiler (implicit via .ts extension)
- Source map support (implied by E2E debugging context)

## Architecture Notes
- Minimal program structure optimized for debugging scenarios
- Type annotations demonstrate TypeScript features for testing
- Strategic breakpoint placement for E2E test automation
- No external dependencies or complex logic - focuses on debugging workflow verification

## Testing Context
The `// BREAK_HERE` comment (L3) serves as a marker for automated debugging tests to verify breakpoint functionality in TypeScript environments with source map support.