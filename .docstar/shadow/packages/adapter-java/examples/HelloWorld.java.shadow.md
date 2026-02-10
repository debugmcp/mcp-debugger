# packages/adapter-java/examples/HelloWorld.java
@source-hash: 9bb57ebd85c3f37a
@generated: 2026-02-10T00:41:19Z

## Purpose
Test program for Java debug adapter functionality. Provides a simple execution flow with variables, loops, and console output for debugging scenarios.

## Key Components

### HelloWorld Class (L4-20)
- **main method (L5-19)**: Entry point with sequential execution flow designed for debug testing
  - Variable initialization: `message` string (L8), `count` integer (L9)
  - For loop (L11-14): Iterates 3 times, accumulates values in `count`, prints iteration state
  - Console output statements (L6, L13, L16-18): Multiple print points for debugging breakpoints

## Execution Flow
1. Initialization phase with startup message (L6)
2. Variable setup with string and counter (L8-9) 
3. Loop execution with state tracking (L11-14)
4. Final output phase with results display (L16-18)

## Debug Adapter Testing Features
- Multiple breakpoint opportunities at print statements
- Variable state changes in loop for step-through debugging
- Simple control flow for testing step-over/step-into functionality
- Clear program lifecycle (start → process → end)

## Dependencies
- Standard Java library (`System.out` for console output)
- No external dependencies

## Architecture Notes
- Minimal single-class design for focused debug testing
- Intentionally simple logic to isolate debug adapter behavior
- Sequential execution without complex branching or error handling