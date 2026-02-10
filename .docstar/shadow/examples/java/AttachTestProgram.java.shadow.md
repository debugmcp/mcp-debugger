# examples/java/AttachTestProgram.java
@source-hash: c7080d55130ae9fe
@generated: 2026-02-10T00:41:38Z

## Purpose
Test program designed for debugger attachment and breakpoint testing. Provides a simple, predictable execution loop with clear debugging targets.

## Key Components
- **AttachTestProgram class** (L2-23): Main container for the test application
- **main method** (L3-22): Entry point that runs an infinite loop with debug-friendly behavior

## Execution Flow
1. **Initialization** (L4): Prints startup message indicating readiness for debugger attachment
2. **Counter loop** (L6-21): Infinite loop incrementing counter every second with console output
3. **Sleep mechanism** (L11-15): 1-second delay with InterruptedException handling for clean termination
4. **Debug target** (L17-20): Conditional block triggered at counter >= 5, ideal for breakpoint placement

## Debug-Specific Features
- **Predictable timing**: 1-second intervals make debugging timing-dependent scenarios easy
- **State visibility**: Counter value printed each iteration for execution tracking  
- **Breakpoint target**: Comment on L17 explicitly marks the conditional block as intended for breakpoints
- **Graceful interruption**: InterruptedException handling allows clean program termination during debugging

## Dependencies
- Standard Java runtime (System.out, Thread.sleep, InterruptedException)
- No external dependencies

## Architectural Notes
- Simple single-threaded design optimized for debugging rather than production use
- Infinite loop ensures program remains running until explicitly terminated
- Clear console output provides visual confirmation of program state during debugging sessions