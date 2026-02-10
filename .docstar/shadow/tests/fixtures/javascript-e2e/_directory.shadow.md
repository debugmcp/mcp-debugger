# tests/fixtures/javascript-e2e/
@generated: 2026-02-10T21:26:12Z

## Purpose
This directory contains E2E testing fixtures specifically designed for testing JavaScript/TypeScript debugging capabilities with source map support. It serves as a controlled environment for validating debugging workflows and breakpoint functionality in development tools.

## Key Components
- **app.ts**: Minimal TypeScript program serving as the primary test fixture
  - Contains strategically placed breakpoint markers (`// BREAK_HERE`)
  - Demonstrates basic TypeScript features (type annotations, string transformations)
  - Provides predictable execution flow for automated testing

## Public API Surface
The main entry point is `app.ts`, which can be:
- Compiled and executed by TypeScript tooling
- Used by debugging tools to test breakpoint placement
- Analyzed by source map generators and consumers
- Integrated into E2E test suites for development tool validation

## Internal Organization
The fixture follows a minimal structure optimized for testing:
1. Simple variable declarations with explicit typing
2. Basic data transformation operations
3. Designated breakpoint locations marked with comments
4. Console output for execution verification

## Testing Patterns
- **Breakpoint Testing**: Uses comment markers to indicate where automated tests should set breakpoints
- **Source Map Validation**: TypeScript compilation enables testing of source map accuracy
- **Debugging Workflow**: Provides a controlled environment for testing step-through debugging
- **Tool Integration**: Designed for integration with various development and testing tools

## Dependencies
- TypeScript compiler for transpilation
- Source map generation and consumption
- Node.js runtime for execution
- Compatible with various debugging and development tools

This fixture directory enables reliable, reproducible testing of debugging capabilities across different JavaScript/TypeScript development environments.