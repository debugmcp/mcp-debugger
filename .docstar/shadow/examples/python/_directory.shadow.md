# examples\python/
@children-hash: 0859d8fbd8f03319
@generated: 2026-02-15T09:01:24Z

## Overall Purpose and Responsibility

The `examples/python` directory serves as a collection of debugging test scenarios and educational examples for MCP (Message Control Protocol) server functionality. This module provides a comprehensive suite of Python scripts designed to exercise debugger capabilities, test breakpoint functionality, and demonstrate various programming patterns in controlled environments.

## Key Components and Integration

The directory contains four complementary test scripts, each targeting different aspects of debugging workflow:

- **fibonacci.py**: Focuses on algorithm comparison and intentional bug injection, implementing both recursive O(2^n) and iterative O(n) Fibonacci calculations with deliberate error introduction for debugging practice
- **python_test_comprehensive.py**: Serves as the primary comprehensive test suite with 6 distinct debugging scenarios covering variable assignment, function calls, data structures, and control flow
- **simple_test.py**: Provides minimal debugging target with basic variable swap operation, ideal for introductory debugging demonstrations
- **test_python_debug.py**: Offers mathematical operations focus with factorial, summation, and data processing functions for step-through debugging

## Public API Surface

### Main Entry Points
All scripts follow the standard Python `if __name__ == "__main__"` pattern, making them executable as standalone debugging targets:

- `fibonacci.py`: Demonstrates algorithm debugging with bug detection
- `python_test_comprehensive.py::main()`: Comprehensive debugging scenario orchestrator
- `simple_test.py::main()`: Minimal breakpoint testing
- `test_python_debug.py::main()`: Mathematical operations debugging

### Core Functions Available for Testing
- **Recursive algorithms**: `fibonacci_recursive()`, `factorial()` implementations
- **Iterative patterns**: `fibonacci_iterative()`, `calculate_sum()`, `sum_list()`
- **Data processing**: `process_data()` for list transformation
- **Variable manipulation**: Basic assignment, swapping, arithmetic operations

## Internal Organization and Data Flow

The scripts are organized by complexity and debugging focus:

1. **Simple → Complex**: From basic variable swaps to comprehensive multi-scenario testing
2. **Algorithm Types**: Recursive vs iterative implementations for comparative debugging
3. **Error Scenarios**: Intentional bugs (fibonacci.py) for debugging skill development
4. **Coverage Areas**: Variable inspection, call stack analysis, control flow, data structure manipulation

## Important Patterns and Conventions

### Debugging-Optimized Design
- Clear variable naming and explicit state changes
- Strategic comment placement indicating intended breakpoint locations
- Self-contained functions with single responsibilities
- Predictable, deterministic outputs for validation
- No external dependencies to minimize debugging complexity

### Educational Structure
- Progressive complexity from simple_test.py to python_test_comprehensive.py
- Multiple implementation approaches (recursive vs iterative) for comparison
- Intentional bug injection for realistic debugging scenarios
- Comprehensive coverage of Python language features commonly debugged

### Execution Patterns
All scripts implement consistent execution flow: initialization → processing → output, with clear state transitions suitable for step-through debugging and breakpoint analysis.