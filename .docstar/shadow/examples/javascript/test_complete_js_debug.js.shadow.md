# examples/javascript/test_complete_js_debug.js
@source-hash: 82636f381ecc3d5c
@generated: 2026-02-10T00:41:40Z

## Purpose
JavaScript debugging demonstration script that showcases various debugging features including breakpoints, stack traces, variable inspection, and expression evaluation. Designed as a test harness for debugging tools and environments.

## Key Components

### Data Structures
- **testData** (L13-17): Configuration object containing metadata about the debugging test, including name, version, and feature list

### Core Functions
- **deepFunction(level)** (L20-28): Recursive function that creates a call stack of specified depth. Returns when level reaches 0, setting up a predictable stack trace for debugging. Contains strategic console.log at L25 for breakpoint placement.

- **testVariables()** (L31-42): Demonstrates variable inspection capabilities with diverse data types (number, string, array, object with nested properties). Includes console.log at L37 as breakpoint target and expression evaluation via arithmetic operation.

- **main()** (L45-60): Async orchestrator function that executes the debugging tests in sequence. Runs stack trace test with depth 3, then variable inspection test, with detailed console output for each phase.

### Execution Context
- **Script entry point** (L63-66): Executes main() with error handling, ensuring process exit on failure

## Architecture Patterns
- **Test segmentation**: Clear separation of different debugging scenarios (stack traces vs variable inspection)
- **Breakpoint markers**: Strategic console.log statements at L25 and L37 specifically noted as "good for breakpoint" in comments
- **Progressive complexity**: Tests move from simple stack depth to complex variable structures

## Dependencies
- Node.js runtime (implied by `process.exit(1)`)
- Console API for output and debugging markers

## Debug-Specific Design
- Recursive function creates predictable call stack depths
- Mixed data types in testVariables() enable comprehensive variable inspection
- Synchronous execution flow with async wrapper for error handling
- Clear console output sections for test phase identification