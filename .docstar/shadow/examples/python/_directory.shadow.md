# examples/python/
@generated: 2026-02-10T21:26:19Z

## Overall Purpose
This directory contains a collection of Python test scripts specifically designed for MCP (Message Control Protocol) debugger testing and development. The module serves as a comprehensive test suite providing various debugging scenarios, from simple variable operations to complex algorithmic implementations, enabling thorough validation of debugging capabilities.

## Key Components and Organization

### Test Script Categories
- **Simple Debugging Scripts**: `simple_test.py` - minimal variable swap operations for basic breakpoint testing
- **Algorithmic Test Scripts**: `fibonacci.py`, `test_python_debug.py` - mathematical functions (factorial, Fibonacci) for step-through debugging
- **Comprehensive Test Suite**: `python_test_comprehensive.py` - extensive debugging scenario coverage with 6 distinct test cases

### Core Algorithmic Implementations
- **Fibonacci Calculations**: Both recursive O(2^n) and iterative O(n) implementations across multiple files
- **Factorial Functions**: Recursive and iterative variants for call stack debugging
- **List Processing**: Summation, doubling, and basic data manipulation operations
- **Control Flow Testing**: Conditional branches, loops, and variable state changes

## Public API Surface

### Primary Entry Points
Each script functions as an independent executable with standard Python main guards:
- `simple_test.main()` - Basic variable swap demonstration
- `fibonacci.main()` - Dual-approach Fibonacci with intentional bug injection
- `python_test_comprehensive.main()` - Six-scenario comprehensive debugging test
- `test_python_debug.main()` - Mathematical operations debugging workflow

### Common Function Patterns
- **fibonacci(n)** - Available in multiple implementations across files
- **factorial(n)** - Recursive mathematical computation in several variants  
- **sum_list(numbers)** - List processing operations
- **process_data(data)** - Data transformation utilities

## Internal Organization and Data Flow

### Execution Pattern
All scripts follow consistent structure:
1. Function definitions with single-responsibility design
2. main() orchestration function containing test scenarios
3. Standard `if __name__ == "__main__"` execution guard
4. Print-based output for debugging observation

### Debugging Architecture
- **Breakpoint Targets**: Strategic comment markers and simple operations ideal for breakpoint placement
- **State Observation**: Clear variable mutations and transformations for inspection
- **Algorithm Variety**: Different computational approaches (recursive vs iterative) for diverse debugging scenarios
- **Error Injection**: Intentional bugs in fibonacci.py for debugging practice

## Important Patterns and Conventions

### Testing Philosophy
- **Self-Contained**: No external dependencies beyond Python standard library
- **Deterministic**: Predictable outputs for consistent debugging validation  
- **Educational**: Clear, readable code optimized for learning rather than performance
- **Incremental Complexity**: From simple variable operations to multi-step algorithmic processes

### Debugging-Specific Design
- **Explicit Breakpoint Hints**: Comments indicating optimal debugging locations
- **Variable Naming**: Clear, descriptive identifiers for easy inspection
- **State Transitions**: Obvious before/after states for debugging verification
- **Error Scenarios**: Both correct implementations and intentional bugs for comprehensive testing

This module serves as a complete debugging test harness for MCP server development, providing graduated complexity levels from basic variable manipulation to sophisticated algorithmic debugging scenarios.