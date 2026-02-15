# tests\fixtures\debug-scripts/
@children-hash: e56cb523ec17f4f3
@generated: 2026-02-15T09:01:24Z

## Overall Purpose

Test fixtures directory containing simple debug scripts designed for validating debugger functionality, mock adapters, and debugging workflows. These scripts serve as controlled, predictable test cases for testing debugging tools, breakpoint behavior, variable inspection, and error handling capabilities.

## Key Components

**Language Coverage:**
- **simple-mock.js**: JavaScript fixture for mock adapter testing and path validation
- **simple.py**: Python fixture for basic debugging workflow validation  
- **with-errors.py**: Python fixture for exception handling testing
- **with-variables.py**: Python fixture for variable inspection across data types and scopes

## Component Relationships

The fixtures are designed as independent, self-contained scripts that collectively provide comprehensive test coverage for debugging scenarios:

- **simple-mock.js** and **simple.py** provide baseline functionality testing with predictable outputs
- **with-errors.py** tests error condition handling and exception debugging
- **with-variables.py** tests variable inspection capabilities across different data types and scope levels

## Public API Surface

All scripts follow standard execution patterns:
- **JavaScript**: Direct function execution (`main()` call)  
- **Python**: Standard module pattern with `if __name__ == "__main__"` guards

**Entry Points:**
- `simple-mock.js`: Immediate execution returning value 30
- `simple.py`: `main()` function with marked breakpoint locations
- `with-errors.py`: `main()` function guaranteed to throw ZeroDivisionError
- `with-variables.py`: `test_variables()` function demonstrating variable types and scopes

## Internal Organization

**Data Flow Pattern:**
1. Simple computation (variable assignment → calculation → output → return)
2. Controlled failure paths (error generation for exception testing)
3. Variable inspection scenarios (multiple data types and nested scopes)

**Testing Categories:**
- **Path Validation**: simple-mock.js for mock adapter testing
- **Breakpoint Testing**: simple.py with explicit breakpoint markers
- **Exception Testing**: with-errors.py for error handling validation
- **Variable Inspection**: with-variables.py for debugger variable display testing

## Important Patterns

- **Minimal Complexity**: All scripts intentionally simple to avoid side effects in test environments
- **Predictable Behavior**: Known outputs and execution paths for reliable testing
- **No External Dependencies**: Self-contained scripts using only standard library functions
- **Strategic Comments**: Explicit markers for breakpoint locations and testing guidance
- **Multi-Language Support**: Covers both JavaScript and Python debugging scenarios

The directory provides a comprehensive suite of debug fixtures that testing frameworks and debugging tools can use to validate their functionality across different languages, error conditions, and debugging scenarios.