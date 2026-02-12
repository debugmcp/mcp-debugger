# tests/fixtures/debug-scripts/
@generated: 2026-02-11T23:47:37Z

## Overall Purpose
Test fixtures directory containing debug scripts for validating debugger functionality and testing debugging workflows. This collection provides controlled test environments with predictable behaviors for exercising various debugging scenarios including breakpoints, variable inspection, error handling, and multi-language support.

## Key Components & Organization

### Language Coverage
- **Python scripts** (`simple.py`, `with-errors.py`, `with-variables.py`): Core debugging scenarios in Python
- **JavaScript scripts** (`simple-mock.js`): Basic JavaScript debugging support and path validation

### Debugging Scenario Coverage
- **Basic execution flow** (`simple.py`, `simple-mock.js`): Minimal scripts for breakpoint placement and step-through testing
- **Exception handling** (`with-errors.py`): Controlled error generation (ZeroDivisionError) for exception debugging workflows
- **Variable inspection** (`with-variables.py`): Multi-type variable testing across different scopes (local, nested function)

### Test Categories
1. **Breakpoint Testing**: Scripts with marked breakpoint locations and predictable execution paths
2. **Error Simulation**: Intentional exception generation for debugging error scenarios
3. **Scope Analysis**: Variable visibility testing across function boundaries and nested contexts
4. **Path Validation**: Simple scripts for testing file system integration and mock adapters

## Public API Surface
All scripts are designed as standalone executables with standard entry points:
- **Python scripts**: Use `if __name__ == "__main__"` pattern for direct execution
- **JavaScript scripts**: Direct function invocation pattern
- **Common interface**: Each script provides predictable output and well-defined execution behavior

## Internal Architecture Patterns
- **Minimal dependencies**: All scripts use only standard library functions
- **Controlled complexity**: Simple, linear execution flows to avoid test interference
- **Explicit markers**: Comment-based breakpoint indicators and clear execution checkpoints
- **Predictable outputs**: Known return values and console outputs for assertion testing

## Data Flow & Integration
Scripts operate independently but share common patterns:
1. **Setup phase**: Variable initialization and state preparation
2. **Execution phase**: Core logic with marked debugging points
3. **Output phase**: Predictable results for validation
4. **Error scenarios**: Controlled failure paths where applicable

## Critical Design Constraints
- **Test isolation**: Each script is self-contained with no cross-dependencies
- **Deterministic behavior**: Consistent outputs across executions
- **Debug-friendly structure**: Clear breakpoint locations and variable inspection points
- **Multi-language support**: Consistent debugging patterns across Python and JavaScript

This fixture collection enables comprehensive testing of debugging tools, IDE integrations, and debugging workflow automation across multiple programming languages.