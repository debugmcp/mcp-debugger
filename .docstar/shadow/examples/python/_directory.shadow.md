# examples/python/
@generated: 2026-02-09T18:16:08Z

## Purpose
Collection of Python test scripts designed for MCP (Model Context Protocol) server debugging and testing scenarios. Provides diverse examples of Python code patterns, control structures, and debugging scenarios to validate debugger functionality and demonstrate debugging techniques.

## Key Components

### Test Scripts by Complexity

**Simple Test Cases**
- `simple_test.py`: Minimal debugging example with variable swapping and clear breakpoint locations
- Basic entry point for debugging practice with straightforward execution flow

**Comprehensive Test Suite**
- `python_test_comprehensive.py`: Full-featured test script with 6 distinct debugging scenarios covering recursion, loops, data structures, and conditional logic
- Primary test orchestrator for thorough MCP debugger validation

**Mathematical Function Tests**
- `test_python_debug.py`: Collection of mathematical operations (factorial, summation, data transformation) with predictable input/output relationships
- `fibonacci.py`: Dual implementation test (recursive vs iterative) with intentional bugs for debugging practice

## Component Relationships

### Shared Patterns
- **Fibonacci implementations**: Both `fibonacci.py` and `python_test_comprehensive.py` include Fibonacci calculations for recursive debugging scenarios
- **Mathematical operations**: Factorial and summation functions appear across multiple scripts for algorithm debugging
- **Print-based verification**: All scripts use console output for state inspection and result validation

### Testing Hierarchy
1. **Entry Level**: `simple_test.py` for basic debugging concepts
2. **Intermediate**: `test_python_debug.py` for mathematical function debugging  
3. **Advanced**: `python_test_comprehensive.py` for comprehensive language construct testing
4. **Specialized**: `fibonacci.py` for intentional bug detection and correction

## Public API Surface

### Entry Points
All scripts follow standard Python execution pattern with `if __name__ == "__main__"` and `main()` function as primary entry point.

### Key Functions by Category
- **Recursive algorithms**: `fibonacci()`, `factorial()`  
- **Iterative processing**: `sum_list()`, `calculate_sum()`, `process_data()`
- **Test orchestration**: `main()` functions in each script

## Internal Organization

### Data Flow Pattern
1. **Variable initialization** with simple data types and collections
2. **Function execution** with clear input parameters
3. **Result computation** and intermediate value tracking
4. **Output verification** through print statements

### Debugging Features
- **Breakpoint-friendly code**: Explicit variable assignments and state changes
- **Linear execution flow**: Minimal branching for predictable debugging
- **State visibility**: Print statements at key execution points
- **Error scenarios**: Intentional bugs in `fibonacci.py` for debugging practice

## Important Conventions

### Code Structure
- No external dependencies (pure Python standard library)
- Procedural design with clear function separation
- Consistent naming patterns and documentation
- Self-contained execution without file I/O or network operations

### Debugging Optimization  
- **Clear variable names** for easy inspection
- **Predictable algorithms** with known correct outputs
- **Multiple complexity levels** for progressive debugging skill development
- **Isolation**: Each script can run independently for focused testing

This directory serves as a comprehensive testing suite for MCP debugger functionality, providing both simple learning examples and complex debugging scenarios to validate server capabilities across different Python language constructs.