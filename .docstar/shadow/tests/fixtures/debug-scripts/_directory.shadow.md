# tests/fixtures/debug-scripts/
@generated: 2026-02-10T21:26:14Z

## Overall Purpose
This directory contains test fixture scripts specifically designed for debugging and mock testing scenarios. The scripts serve as controlled, predictable test subjects for validating debugger functionality, exception handling, and mock adapter implementations across JavaScript and Python environments.

## Key Components & Relationships
The directory contains four specialized test fixtures, each targeting different debugging scenarios:

- **simple.py** - Minimal Python script with explicit breakpoint markers for testing step-through debugging, variable inspection, and basic execution flow validation
- **with-variables.py** - Python variable inspection test fixture demonstrating multiple data types (int, str, list, dict) and nested scope scenarios for debugger variable display testing
- **with-errors.py** - Exception generation fixture that reliably produces ZeroDivisionError for testing error handling and exception debugging workflows
- **simple-mock.js** - JavaScript path validation fixture for mock adapter testing, providing predictable execution without complexity

## Public API Surface
All scripts are designed as standalone executables with standard entry points:
- Python scripts use `if __name__ == "__main__"` patterns with `main()` functions
- JavaScript script provides direct function execution
- Each fixture is self-contained with no external dependencies
- Predictable outputs enable automated assertion testing

## Internal Organization & Data Flow
Scripts follow a simple linear execution pattern optimized for testing:
1. **Entry Point** - Standard module execution guards
2. **Core Logic** - Minimal, focused functionality (arithmetic operations, variable assignments)
3. **Output Generation** - Console output or return values for verification
4. **Intentional Behavior** - Specific scenarios (breakpoints, errors, scope testing)

## Important Patterns & Conventions
- **Minimal Complexity**: All fixtures avoid unnecessary complexity to prevent side effects in test environments
- **Predictable Behavior**: Each script produces known, expected outcomes for reliable testing
- **Clear Markers**: Comment-based breakpoint indicators and explicit scope boundaries
- **Language Coverage**: Supports both Python and JavaScript debugging scenarios
- **Error Isolation**: Controlled failure modes (ZeroDivisionError) for exception testing

This fixture collection enables comprehensive testing of debugging tools, mock adapters, and development workflows across multiple programming languages.