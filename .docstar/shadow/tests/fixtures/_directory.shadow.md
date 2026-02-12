# tests\fixtures/
@generated: 2026-02-12T21:06:01Z

## Overall Purpose

The `tests/fixtures` directory serves as a comprehensive collection of minimal test programs and mock infrastructure designed for end-to-end validation of debugging tools, adapters, and protocols across multiple programming languages. This fixture collection provides controlled, predictable environments for testing debugging workflows, breakpoint functionality, exception handling, variable inspection, and protocol compliance without the complexity of real application code.

## Key Components & Integration

### Multi-Language Debug Targets
- **Python fixtures** (`debug_test_simple.py`, `simple.py`, `with-errors.py`, `with-variables.py`): Comprehensive Python debugging scenarios covering basic execution, error conditions, and complex variable inspection
- **JavaScript/TypeScript fixtures** (`app.ts`, `simple-mock.js`): Frontend debugging scenarios with source map support and breakpoint validation
- **Mock infrastructure** (`debugpy_server.py`): DAP-compliant debug server for testing protocol integration

### Functional Test Categories
1. **Basic Debugging Workflows**: Simple execution paths with strategic breakpoint locations
2. **Error Scenario Testing**: Controlled exception generation and handling validation  
3. **Advanced Debugging Features**: Variable inspection across scopes, data types, and language boundaries
4. **Protocol Testing**: DAP compliance and mock adapter functionality validation
5. **Source Map Testing**: TypeScript-to-JavaScript debugging accuracy verification

## Public API Surface

### Primary Entry Points
- **Debug Targets**: Each fixture provides standard language entry points (`main()` functions, direct execution)
- **Mock Server**: `debugpy_server.py` exposes DAP protocol interface on localhost:5678
- **Breakpoint Markers**: Standardized `// BREAK_HERE` and comment-based breakpoint indicators across all fixtures

### Test Integration Points
- **Predictable Outputs**: Fixed arithmetic operations and known variable states for assertion testing
- **Error Boundaries**: Controlled exception scenarios (`ZeroDivisionError` in `with-errors.py`)
- **Multi-Scope Variables**: Complex data structures and nested scopes for inspection testing
- **Protocol Compliance**: Standard DAP command handling for debugger integration testing

## Internal Organization & Data Flow

### Execution Pattern
1. **Fixture Selection**: Tests choose appropriate fixtures based on debugging scenario requirements
2. **Infrastructure Setup**: Mock servers and debug targets launched as needed
3. **Debugging Attachment**: Test harnesses connect debuggers to running fixtures
4. **Workflow Validation**: Breakpoints, variable inspection, and error handling tested
5. **Cleanup**: Graceful shutdown of all fixtures and mock infrastructure

### Directory Structure
```
tests/fixtures/
├── debug-scripts/     # Language-specific minimal debugging targets
├── javascript-e2e/    # TypeScript/JavaScript debugging scenarios
└── python/           # Python debugging targets and mock server infrastructure
```

## Important Patterns & Conventions

### Design Principles
- **Minimal Complexity**: All fixtures intentionally simple to isolate debugging functionality from business logic
- **Self-Contained**: No external dependencies beyond standard libraries for reliable test execution
- **Deterministic Behavior**: Predictable inputs/outputs enable consistent test assertions
- **Protocol Adherence**: Mock infrastructure follows standard debugging protocols (DAP)

### Testing Conventions
- **Explicit Markers**: Clear breakpoint indicators and variable inspection locations
- **Language Coverage**: Comprehensive support for Python and JavaScript/TypeScript debugging scenarios  
- **Scenario Isolation**: Each fixture targets specific debugging capabilities without side effects
- **End-to-End Support**: Complete debugging workflows from connection establishment to cleanup

This fixture collection enables comprehensive validation of debugging tool integration, protocol compliance, and multi-language debugging scenarios in a controlled, predictable testing environment.