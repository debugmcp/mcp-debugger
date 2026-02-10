# tests/fixtures/debug-scripts/
@generated: 2026-02-09T18:16:05Z

## Overview
Test fixtures collection providing controlled debugging scenarios for validating debugger functionality, mock adapters, and error handling capabilities. Contains minimal scripts with predictable execution patterns designed for testing debugging tools and infrastructure.

## Directory Purpose
Serves as a controlled testing environment for debugging-related functionality with scripts that exhibit specific, predictable behaviors:
- Simple arithmetic operations with clear execution flow
- Deliberate runtime errors for exception handling testing
- Variable scope inspection scenarios
- Mock adapter path resolution validation

## Key Components

### Python Test Fixtures
- **simple.py**: Basic arithmetic script with strategic breakpoint markers for step-through debugging tests
- **with-errors.py**: Error-generating script that deliberately triggers ZeroDivisionError for exception handling validation
- **with-variables.py**: Variable inspection test script demonstrating different data types and nested scopes

### JavaScript Test Fixtures  
- **simple-mock.js**: Mock script for testing JavaScript adapter functionality and file path resolution

## Component Relationships
All scripts follow similar architectural patterns:
- Single entry points (`main()` functions or direct execution)
- Linear, predictable execution flows
- Explicit comment markers indicating intended breakpoint locations
- No external dependencies (self-contained test data)
- Standard language idioms (Python `if __name__ == "__main__"` guards, JavaScript function calls)

## Testing Scenarios Covered
- **Basic debugging flow**: Step-through execution with simple arithmetic
- **Exception handling**: Unhandled runtime errors for error scenario testing
- **Variable inspection**: Multiple data types and scope boundaries
- **Mock functionality**: Path resolution and adapter behavior validation
- **Cross-language support**: Both Python and JavaScript debugging scenarios

## Usage Context
Located in `tests/fixtures/`, indicating these are test data files consumed by debugging infrastructure tests rather than executable production code. Each script is designed to fail or succeed in predictable ways to validate specific debugger capabilities.

## Integration Points
Scripts serve as targets for:
- Debugger attachment and breakpoint setting
- Variable inspection and scope traversal
- Exception handling and error reporting
- Mock adapter validation
- Cross-language debugging tool testing