# tests\fixtures\debug-scripts/
@generated: 2026-02-12T21:00:52Z

## Overall Purpose
Test fixtures directory providing simple, predictable scripts for validating debugging functionality and mock adapters. Contains minimal executable scripts designed specifically for testing debugger capabilities, breakpoint handling, variable inspection, and error scenarios without complex dependencies or side effects.

## Key Components

### Language Coverage
- **Python fixtures** (`simple.py`, `with-errors.py`, `with-variables.py`): Core debugging test scenarios
- **JavaScript fixture** (`simple-mock.js`): Mock adapter and path validation testing

### Test Scenario Categories

**Basic Execution Testing**
- `simple.py`: Minimal arithmetic operation with strategic breakpoint markers
- `simple-mock.js`: Basic variable operations for path validation and execution testing

**Error Handling Validation**  
- `with-errors.py`: Controlled ZeroDivisionError generation for exception handling testing

**Variable Inspection Testing**
- `with-variables.py`: Multi-type variable scenarios (int, str, list, dict) across different scopes

## Public API Surface
All scripts follow standard execution patterns:
- **Python**: `if __name__ == "__main__"` entry points calling main test functions
- **JavaScript**: Direct function invocation pattern
- **Common**: Self-contained scripts with predictable outputs for assertion testing

## Internal Organization
Scripts are organized by testing purpose rather than language:
- Execution flow testing (simple scripts)
- Exception scenario testing (error scripts) 
- State inspection testing (variable scripts)
- Mock/path validation testing (mock scripts)

## Data Flow Patterns
- **Linear execution**: Simple start-to-finish flows for basic testing
- **Controlled failure**: Intentional exception paths for error handling validation
- **Scope demonstration**: Nested functions to test variable inspection across scopes
- **Minimal dependencies**: Standard library only to avoid test environment complications

## Testing Conventions
- Strategic comment markers indicating intended breakpoint locations
- Predictable variable names and values for assertion testing
- Self-contained execution without external state dependencies
- Intentionally simple syntax to focus on debugging functionality rather than code complexity

This directory serves as a comprehensive test suite for debugging tools, providing controlled environments to validate breakpoint handling, variable inspection, error scenarios, and cross-language debugging capabilities.