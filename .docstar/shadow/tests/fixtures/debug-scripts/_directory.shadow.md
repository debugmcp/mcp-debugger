# tests/fixtures/debug-scripts/
@generated: 2026-02-10T01:19:37Z

## Purpose
Collection of minimal test fixture scripts designed for debugging tool validation and testing. This directory provides controlled, predictable execution environments for testing debugger functionality, mock adapters, and debug workflow validation across multiple languages.

## Directory Organization
The directory contains language-specific debug test scripts:
- **JavaScript fixtures**: `simple-mock.js` - Mock adapter testing and path validation
- **Python fixtures**: `simple.py`, `with-errors.py`, `with-variables.py` - Comprehensive debugging scenario coverage

## Key Components & Integration

### Mock Testing (`simple-mock.js`)
- Minimal JavaScript execution environment for path validation testing
- Provides predictable output (arithmetic: 10 + 20 = 30) for assertion testing
- Tests mock adapter functionality without complex execution overhead
- Self-contained with no external dependencies

### Debug Workflow Testing (`simple.py`)
- Basic breakpoint testing script with clearly marked breakpoint locations
- Validates step-through operations and debugger attachment
- Simple arithmetic flow (10 + 20 = 30) with strategic pause points at lines 5, 7, and 9
- Standard entry point pattern for controlled execution

### Exception Handling Testing (`with-errors.py`)
- Intentional error generation (ZeroDivisionError) for exception testing
- Tests debugger error handling and stack trace functionality
- Guaranteed failure path at line 10 with `divide(10, 0)`
- Validates exception catching and debugging tool error reporting

### Variable Inspection Testing (`with-variables.py`)
- Comprehensive variable type testing (int, str, list, dict)
- Multi-scope debugging with nested function calls
- Tests debugger variable display across different scopes
- Breakpoint location at line 16 for scope transition testing

## Public API Surface
All scripts follow standard execution patterns:
- **JavaScript**: Direct function execution via `main()` call
- **Python**: `if __name__ == "__main__"` guard pattern with `main()` or `test_variables()` entry points

## Testing Patterns
1. **Predictable Output**: All scripts produce consistent, testable results
2. **Minimal Dependencies**: No external libraries to reduce test environment complexity
3. **Clear Breakpoint Markers**: Strategic locations for debugging tool validation
4. **Multi-Language Coverage**: JavaScript and Python fixtures for cross-platform testing
5. **Scenario Coverage**: Normal execution, error conditions, and variable inspection

## Data Flow
Each script operates independently with linear execution flow designed for debugging tool consumption. No inter-script dependencies or shared state, allowing isolated testing of specific debugging scenarios.