# examples/java/
@generated: 2026-02-10T21:26:14Z

## Purpose
Java examples directory containing educational and testing programs for debugger development and debugging practice. Provides simple, well-structured Java code suitable for testing debugging tools, practicing debugging techniques, and demonstrating common programming patterns.

## Key Components

### AttachTestProgram.java
**Debugger attachment test harness** - Infinite loop program designed specifically for testing debugger attachment capabilities and breakpoint functionality. Features predictable timing, clear state visibility, and explicit breakpoint targets.

### TestJavaDebug.java  
**Educational debugging practice program** - Utility class demonstrating common Java programming patterns including recursion, array processing, and mathematical operations. Serves as a comprehensive test case for stepping through various code constructs during debugging.

## Public API Surface

### AttachTestProgram
- **main(String[] args)**: Primary entry point for debugger attachment testing
- Infinite execution loop with 1-second intervals
- Counter-based state progression with breakpoint targets at counter >= 5

### TestJavaDebug
- **main(String[] args)**: Demonstration driver showcasing all utility methods
- **factorial(int n)**: Recursive mathematical computation
- **sumArray(int[] numbers)**: Array aggregation operations  
- **processData(int[] data)**: Array transformation utilities

## Internal Organization

**Testing Philosophy**: Both programs prioritize debugging-friendly design over production robustness
- Clear, predictable execution flows
- Minimal external dependencies (standard Java runtime only)
- Explicit debug targets and state visibility
- Simple single-threaded architectures

**Code Patterns**: 
- Static utility methods for easy testing
- Progressive complexity from basic arithmetic to array operations
- Standard Java idioms (enhanced for-loops, recursive algorithms)
- Console output for execution tracking

## Data Flow
1. **AttachTestProgram**: Continuous loop with periodic state updates and sleep intervals
2. **TestJavaDebug**: Sequential execution of mathematical and array operations with result accumulation

## Usage Context
This directory serves as a **debugging toolkit** for:
- Testing debugger attachment mechanisms
- Practicing step-through debugging techniques
- Validating breakpoint functionality
- Educational debugging scenarios with common programming constructs

The programs are intentionally simple and self-contained, making them ideal for debugging tool development, debugger testing, and Java debugging education.