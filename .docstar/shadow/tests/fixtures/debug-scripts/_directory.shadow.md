# tests\fixtures\debug-scripts/
@generated: 2026-02-12T21:05:41Z

## Overall Purpose
Collection of minimal test fixture scripts designed for validating debugging tools and mock adapter functionality. These scripts provide controlled, predictable environments for testing breakpoints, exception handling, variable inspection, and path validation across different language runtimes (Python and JavaScript).

## Key Components & Organization

### Language-Specific Test Fixtures
- **simple-mock.js**: Minimal JavaScript fixture for mock adapter testing and path validation
- **simple.py**: Basic Python script with strategic breakpoint markers for debugging workflow validation
- **with-errors.py**: Python script that intentionally generates ZeroDivisionError for exception handling testing
- **with-variables.py**: Python script showcasing multiple data types and nested scopes for variable inspection testing

### Functional Categories
1. **Basic Execution Testing**: `simple-mock.js` and `simple.py` provide minimal arithmetic operations with predictable outputs
2. **Error Scenario Testing**: `with-errors.py` provides controlled failure conditions
3. **Advanced Debugging Features**: `with-variables.py` tests complex variable inspection across scopes and data types

## Public API Surface
All scripts function as standalone executables with standard entry points:
- JavaScript: Direct function calls and execution
- Python: Standard `if __name__ == "__main__"` pattern with `main()` functions

Key testing scenarios supported:
- **Path Validation**: Verify script discovery and loading mechanisms
- **Breakpoint Testing**: Validate debugger attachment and step-through functionality
- **Exception Handling**: Test error capture and reporting in debugging tools
- **Variable Inspection**: Validate variable display across different types and scopes

## Internal Organization & Data Flow
Scripts follow a consistent pattern:
1. Simple function definitions with clear execution paths
2. Minimal external dependencies (standard library only)
3. Predictable outputs for assertion testing
4. Strategic comment markers indicating intended breakpoint locations

## Important Patterns & Conventions
- **Minimal Complexity**: All scripts intentionally simple to avoid side effects in test environments
- **Self-Contained**: No external dependencies to ensure reliable test execution
- **Predictable Behavior**: Fixed inputs/outputs enable deterministic testing
- **Multi-Language Support**: Covers both Python and JavaScript debugging scenarios
- **Explicit Debug Markers**: Comments clearly indicate intended breakpoint and testing locations

The directory serves as a comprehensive testing suite for debugging tool validation, providing both positive test cases (successful execution) and negative test cases (controlled failures) across common programming languages and debugging scenarios.