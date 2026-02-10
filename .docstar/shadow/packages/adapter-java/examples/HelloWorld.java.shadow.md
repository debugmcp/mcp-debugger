# packages/adapter-java/examples/HelloWorld.java
@source-hash: 9bb57ebd85c3f37a
@generated: 2026-02-09T18:14:28Z

## Primary Purpose
Simple Java test program designed for testing Java debug adapter functionality. Serves as a basic debugging target with predictable execution flow and variable state changes.

## Key Components
- **HelloWorld class (L4-20)**: Main container class with single static entry point
- **main method (L5-19)**: Entry point demonstrating basic Java constructs for debugging scenarios

## Program Flow
1. Initialization phase (L6-9): Outputs start message, declares string message and integer counter
2. Loop execution (L11-14): Simple for-loop that increments counter and prints iteration state
3. Final output (L16-18): Displays message and final program state

## Key Variables for Debug Testing
- **message (L8)**: String literal "Hello, World!" - unchanged throughout execution
- **count (L9)**: Integer accumulator starting at 0, incremented by loop index values (0+1+2=3)
- **i (L11)**: Loop iterator variable (0, 1, 2)

## Debug Adapter Test Scenarios
- Breakpoint placement opportunities at multiple print statements
- Variable inspection points for primitive types (int, String)
- Step-through debugging of loop iteration
- State observation across method execution lifecycle

## Dependencies
- Standard Java runtime (System.out for console output)
- No external libraries or complex dependencies

## Execution Characteristics
- Deterministic output and variable states
- Short execution time suitable for automated testing
- Clear program phases for debugging validation