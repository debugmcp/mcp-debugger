# examples/java/
@generated: 2026-02-10T01:19:36Z

## Purpose
Educational Java examples directory containing sample programs designed for debugging practice and learning Java development fundamentals. Provides concrete, executable code for testing debugger attachment, breakpoint functionality, and basic Java programming patterns.

## Key Components

### AttachTestProgram.java
**Role**: Debugger attachment target and breakpoint testing platform
- Infinite loop with predictable 1-second intervals
- Clear console output for execution tracking
- Designated breakpoint locations at counter >= 5
- Graceful interruption handling for clean termination

### TestJavaDebug.java
**Role**: Mathematical and array processing utilities for debugging practice
- Static utility methods demonstrating common programming patterns
- Recursive algorithms (factorial computation)
- Array operations (summation, transformation)
- Progressive complexity from basic arithmetic to data processing

## Public API Surface

### AttachTestProgram Entry Points
- **main(String[] args)**: Primary entry point for debugger attachment testing
- Console output: "Program started, ready for debugger attachment"
- Execution loop with visible state transitions

### TestJavaDebug Entry Points
- **main(String[] args)**: Demonstration driver showcasing all utility methods
- **factorial(int n)**: Recursive factorial computation
- **sumArray(int[] numbers)**: Array summation using enhanced for-loop
- **processData(int[] data)**: Array transformation (doubling operation)

## Internal Organization

### Data Flow Patterns
1. **AttachTestProgram**: Linear execution with timing-controlled loops
   - Initialization → Counter loop → Sleep mechanism → Debug targets
2. **TestJavaDebug**: Sequential method demonstrations
   - Basic arithmetic → Recursive computation → Array processing → Result combination

### Common Design Principles
- **Debugging-friendly**: Both programs prioritize clear state visibility and predictable execution
- **Educational focus**: Simple, understandable implementations over optimization
- **Self-contained**: No external dependencies beyond Java standard library
- **Console-driven**: Extensive output for tracking program state during debugging

## Integration Patterns
- **Standalone execution**: Each program runs independently as debugging targets
- **Complementary functionality**: AttachTestProgram for debugger mechanics, TestJavaDebug for algorithm debugging
- **Progressive complexity**: From simple loops to mathematical computations and data structures
- **Consistent timing**: Predictable execution patterns facilitate debugging practice

## Development Conventions
- Static method design for utility functions
- Clear variable naming and console output messages
- Explicit commenting for debugging target locations
- Standard Java exception handling patterns
- No production-level error handling or input validation (intentionally simplified for educational use)