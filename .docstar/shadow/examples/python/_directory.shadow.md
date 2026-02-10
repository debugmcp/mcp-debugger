# examples/python/
@generated: 2026-02-10T01:19:38Z

## Overall Purpose

The `examples/python` directory serves as a comprehensive test suite for MCP (Message Control Protocol) Server debugging functionality. This collection of Python scripts provides controlled debugging scenarios with varying complexity levels, from simple variable operations to recursive algorithms, designed to exercise and validate debugger capabilities.

## Key Components and Organization

### Core Test Scripts
- **`simple_test.py`** - Minimal debugging target with basic variable swap operation, ideal for initial breakpoint testing
- **`test_python_debug.py`** - Intermediate complexity with mathematical functions (factorial, list processing) for step-through debugging
- **`python_test_comprehensive.py`** - Full-featured test suite with 6 distinct debugging scenarios covering all major Python constructs
- **`fibonacci.py`** - Specialized debugging exercise with intentional bugs and algorithm comparison scenarios

### Complexity Progression
The directory follows a graduated complexity approach:
1. **Simple** → Basic variable operations and control flow
2. **Intermediate** → Mathematical algorithms and data processing
3. **Comprehensive** → Multi-scenario testing with diverse Python features
4. **Advanced** → Bug injection and comparative algorithm analysis

## Public API Surface

### Main Entry Points
Each script follows the standard Python execution pattern:
```python
if __name__ == "__main__":
    main()  # or direct execution
```

### Key Debugging Functions
- **Mathematical algorithms**: `factorial()`, `fibonacci_recursive()`, `fibonacci_iterative()`
- **Data processing**: `sum_list()`, `calculate_sum()`, `process_data()`
- **Test orchestration**: `main()` functions in each script

## Internal Data Flow

1. **Script Selection**: Choose appropriate test script based on debugging complexity needs
2. **Function Execution**: Each script demonstrates specific programming patterns (recursion, iteration, data manipulation)
3. **Breakpoint Placement**: Strategic locations marked for debugger interaction
4. **State Inspection**: Variable changes and algorithm behavior observable at each step

## Important Patterns and Conventions

### Debugging-Optimized Design
- **Self-contained**: No external dependencies beyond Python standard library
- **Predictable outputs**: Deterministic behavior for consistent debugging sessions  
- **Clear variable naming**: Optimized for inspection rather than brevity
- **Strategic comments**: Explicit breakpoint location indicators

### Algorithm Coverage
- **Recursive patterns**: Fibonacci and factorial implementations for call stack debugging
- **Iterative patterns**: Loop-based algorithms for step-through analysis
- **Data structure operations**: Lists, dictionaries, and basic collections
- **Control flow**: Conditionals, loops, and function calls

### Educational Structure
Each script balances simplicity with instructional value, providing graduated learning experiences for debugging techniques while serving as comprehensive test cases for MCP Server validation.