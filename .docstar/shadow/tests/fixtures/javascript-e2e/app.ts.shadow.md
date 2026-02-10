# tests/fixtures/javascript-e2e/app.ts
@source-hash: 1cd6846134d9b5e0
@generated: 2026-02-09T18:14:30Z

## Primary Purpose
TypeScript test fixture designed for end-to-end debugging scenarios, specifically testing TypeScript compilation with source map generation and debugger integration.

## Key Components
- **greeting variable (L2)**: String literal constant 'hello world' with explicit TypeScript typing
- **shout variable (L3)**: Transformed uppercase version of greeting with debugging breakpoint marker
- **Console output (L4)**: Simple logging statement for verification

## Dependencies
- TypeScript compiler (implicit - requires compilation to JavaScript)
- Source map support for debugging
- Console API for output

## Architectural Decisions
- Uses explicit TypeScript typing (`string`) for demonstration purposes
- Includes `BREAK_HERE` comment as debugging marker for E2E test automation
- Minimal implementation focuses on basic TypeScript features (type annotations, method calls)

## Purpose in Test Suite
This fixture serves as a controlled environment for testing:
- TypeScript-to-JavaScript compilation
- Source map accuracy during debugging
- Breakpoint placement and variable inspection
- E2E debugging workflow validation

The simplicity is intentional - provides predictable behavior for automated testing scenarios.