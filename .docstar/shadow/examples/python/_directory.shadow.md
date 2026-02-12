# examples\python/
@generated: 2026-02-12T21:00:53Z

## Overall Purpose

This directory serves as a collection of Python test scripts specifically designed for MCP (Message Control Protocol) debugger testing and development. The scripts provide various debugging scenarios, ranging from simple variable operations to complex algorithmic implementations, enabling comprehensive testing of debugging tools and workflows.

## Key Components and Organization

The directory contains four complementary test scripts, each targeting different aspects of debugging:

### Core Test Scripts
- **`simple_test.py`**: Minimal debugging target with basic variable swap operations, ideal for initial debugger setup and basic breakpoint testing
- **`test_python_debug.py`**: Structured debugging exercises featuring mathematical operations (factorial, summation, data processing) in a clear procedural flow  
- **`python_test_comprehensive.py`**: Extensive test suite covering recursive algorithms, data structures (lists/dictionaries), control flow patterns, and multiple debugging scenarios in a single script
- **`fibonacci.py`**: Specialized debugging script with both recursive and iterative Fibonacci implementations, including intentional bugs for error detection testing

## Public API Surface

All scripts follow the standard Python execution pattern with `if __name__ == "__main__"` guards. Key entry points include:

- **Simple debugging**: `simple_test.py` - immediate execution for basic swap operations
- **Mathematical algorithms**: `test_python_debug.py::main()` - factorial, summation, and data processing workflows
- **Comprehensive scenarios**: `python_test_comprehensive.py::main()` - six distinct test cases covering various Python constructs
- **Algorithm comparison**: `fibonacci.py::main()` - comparative analysis of recursive vs iterative approaches with bug injection

## Internal Architecture Patterns

### Common Design Principles
- **Self-contained**: No external dependencies beyond Python standard library
- **Deterministic**: Predictable outputs for consistent debugging validation
- **Educational focus**: Clear variable naming and single-responsibility functions
- **Breakpoint-friendly**: Strategic comment placement and logical separation points

### Algorithmic Coverage
The directory systematically covers:
- **Recursive patterns**: Fibonacci, factorial implementations with call stack debugging
- **Iterative patterns**: Loop-based summation, data processing with variable tracking  
- **Data structures**: List operations, dictionary access, tuple manipulation
- **Control flow**: Conditionals, loops, function calls with state inspection points
- **Error scenarios**: Intentional bugs for debugging tool validation

## Data Flow and Execution Models

Each script follows a similar execution pattern:
1. **Function definitions** with isolated mathematical/algorithmic operations
2. **Main orchestration** function coordinating test scenarios
3. **Standard entry point** ensuring proper script execution context
4. **Print-based validation** providing observable outputs for debugging verification

The scripts progress from simple (single operation) to complex (multiple integrated scenarios), allowing incremental testing of debugging capabilities while maintaining consistent architectural patterns throughout the directory.