# examples/python/
@generated: 2026-02-11T23:47:39Z

## Overall Purpose

The `examples/python` directory serves as a comprehensive test suite for MCP (Message Control Protocol) Server debugging functionality. It provides a collection of Python scripts with varying complexity levels designed to exercise debugger capabilities, from simple variable inspection to recursive function call tracing.

## Key Components and Organization

### Test Script Categories

**Simple Debugging Targets:**
- `simple_test.py`: Minimal variable swap demonstration with explicit breakpoint markers
- Basic control flow testing with clear state transitions

**Algorithmic Test Cases:**
- `fibonacci.py`: Dual-implementation Fibonacci calculator (recursive + iterative) with intentional bug injection for debugging practice
- `test_python_debug.py`: Mathematical operations suite including factorial, summation, and data processing
- `python_test_comprehensive.py`: Extensive debugging scenario collection covering 6 different programming patterns

### Common Patterns Across Scripts

**Mathematical Algorithm Focus:**
- Fibonacci sequence (recursive and iterative implementations)
- Factorial calculations (recursive approach)
- List summation and data processing operations
- Basic arithmetic and variable manipulation

**Debugging-Optimized Design:**
- Explicit breakpoint location comments
- Clear variable state transitions
- Predictable execution flows
- Single-responsibility functions
- Self-contained execution with no external dependencies

## Public API Surface

### Entry Points
Each script follows standard Python execution patterns:
- `if __name__ == "__main__"` guards for direct execution
- `main()` functions as primary orchestrators
- Standalone executable scripts with shebang headers

### Key Test Functions
- **Variable Operations**: Basic assignment, swapping, arithmetic
- **Recursive Algorithms**: Fibonacci and factorial with call stack inspection opportunities  
- **Iterative Patterns**: Loop-based summation and data transformation
- **Data Structures**: List manipulation, dictionary operations
- **Control Flow**: Conditional branching, function calls

## Internal Organization and Data Flow

Scripts are organized by complexity level, from `simple_test.py` (minimal 2-variable swap) to `python_test_comprehensive.py` (6-scenario test suite). Each maintains clear separation between:

1. **Algorithm Implementation**: Pure functions with mathematical operations
2. **Test Orchestration**: Main functions that coordinate multiple test scenarios
3. **Output Generation**: Print statements for debugging verification

The intentional bug in `fibonacci.py` demonstrates error injection for debugging practice, while other scripts focus on correct implementations suitable for step-through analysis.

## Important Patterns and Conventions

- **Educational Focus**: Scripts prioritize debugging clarity over production efficiency
- **Deterministic Behavior**: Predictable outputs enable reliable debugging sessions
- **Progressive Complexity**: From simple variable operations to multi-scenario comprehensive testing
- **Standard Library Only**: No external dependencies to minimize debugging environment complexity
- **Explicit Documentation**: Comments indicate intended breakpoint locations and debugging scenarios

This directory serves as a complete debugging laboratory for MCP Server development, providing graduated complexity levels from basic variable inspection through recursive algorithm analysis.