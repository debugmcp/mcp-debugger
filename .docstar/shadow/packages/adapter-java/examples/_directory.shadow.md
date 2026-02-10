# packages/adapter-java/examples/
@generated: 2026-02-10T01:19:34Z

## Purpose
Example Java programs for testing and demonstrating the Java debug adapter functionality. Provides simple, well-structured code samples that exercise common debugging scenarios and adapter features.

## Key Components

### HelloWorld.java
- **Primary test program**: Simple execution flow with variables, loops, and console output
- **Debug scenario coverage**: Multiple breakpoint opportunities, variable state changes, control flow testing
- **Minimal dependencies**: Uses only standard Java library for focused testing

## Public API Surface
- **Entry Points**: Standard Java main methods that can be executed directly
- **Debug Targets**: Programs designed to be launched and debugged through the adapter
- **Test Scenarios**: Code patterns that exercise step-over, step-into, breakpoints, and variable inspection

## Internal Organization
The directory contains minimal, self-contained Java programs that:
- Provide clear execution flows for debug testing
- Include multiple breakpoint opportunities at strategic locations
- Feature variable state changes suitable for watch/inspection testing
- Use simple control structures (loops, sequential execution) for testing debug navigation

## Debug Adapter Testing Features
- **Breakpoint Testing**: Multiple console output statements for breakpoint placement
- **Step Debugging**: Simple loops and sequential code for step-over/step-into testing
- **Variable Inspection**: Local variables with changing state throughout execution
- **Lifecycle Testing**: Clear program phases (initialization → processing → completion)

## Patterns and Conventions
- Single-class programs for focused testing
- Intentionally simple logic to isolate debug adapter behavior
- Sequential execution flows without complex branching
- Console output at key points for visual debugging confirmation
- No external dependencies to minimize setup complexity

## Role in System
Serves as the validation and demonstration layer for the Java debug adapter, providing concrete test cases that verify adapter functionality across common Java debugging scenarios.