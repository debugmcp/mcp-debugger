# tests\fixtures/
@children-hash: 76290f14a111711a
@generated: 2026-02-15T09:01:40Z

## Overall Purpose

The `tests\fixtures` directory serves as a comprehensive test fixtures repository for validating debugging functionality across multiple programming languages and debugging scenarios. It provides controlled, predictable test environments for testing debugger capabilities, breakpoint behavior, variable inspection, error handling, and debugging protocol interactions.

## Key Components and Relationships

**Language-Specific Debug Targets:**
- **debug-scripts/**: Multi-language fixtures (JavaScript/Python) for basic debugging workflow validation
- **javascript-e2e/**: TypeScript-specific fixtures with source map support for E2E testing
- **python/**: Python-focused fixtures including both debuggee targets and mock debugging infrastructure

**Testing Categories Coverage:**
- **Basic Debugging**: Simple scripts with predictable execution flows and breakpoint locations
- **Error Handling**: Controlled exception scenarios for testing error debugging capabilities
- **Variable Inspection**: Comprehensive coverage of data types, scopes, and variable states
- **Protocol Testing**: Mock DAP server implementation for debugging protocol validation
- **Source Maps**: TypeScript compilation testing for advanced debugging features

## Public API Surface

**Primary Entry Points:**
- `debug-scripts/simple.py` and `debug-scripts/simple-mock.js`: Basic debugging workflow validation
- `debug-scripts/with-errors.py`: Exception handling testing with guaranteed ZeroDivisionError
- `debug-scripts/with-variables.py`: Variable inspection across multiple data types and scopes
- `javascript-e2e/app.ts`: TypeScript debugging with source map support and strategic breakpoint placement
- `python/debug_test_simple.py`: Comprehensive Python debuggee with documented breakpoint locations
- `python/debugpy_server.py`: Mock DAP server for debugging protocol testing (port 5678)

**Integration Patterns:**
- All scripts follow standard execution patterns with `main()` functions or `if __name__ == "__main__"` guards
- Strategic comment markers (`// BREAK_HERE`, line number documentation) for automated test targeting
- Minimal external dependencies ensuring reliable test environment compatibility

## Internal Organization and Data Flow

**Test Execution Architecture:**
1. **Fixture Selection**: Choose appropriate fixture based on testing scenario (language, feature, complexity)
2. **Debuggee Execution**: Run target scripts with predictable execution paths and breakpoint opportunities
3. **Protocol Interaction**: Utilize mock servers for DAP protocol testing and validation
4. **Validation**: Verify debugging tool functionality against known, controlled outcomes

**Cross-Language Testing Flow:**
- JavaScript fixtures validate mock adapters and basic debugging workflows
- Python fixtures provide comprehensive debugging scenario coverage including error conditions
- TypeScript fixtures enable source map and compilation testing scenarios

## Important Patterns and Conventions

**Fixture Design Principles:**
- **Minimal Complexity**: All fixtures intentionally simple to avoid side effects and ensure predictable behavior
- **Self-Contained**: No external dependencies beyond standard libraries for maximum test environment compatibility
- **Strategic Instrumentation**: Explicit breakpoint markers, variable state documentation, and execution path predictability
- **Multi-Scenario Coverage**: Comprehensive testing across normal execution, error conditions, and variable inspection scenarios

**Testing Integration:**
- Fixtures designed for integration with automated testing frameworks and CI/CD pipelines
- Standardized entry points and execution patterns across all languages
- Mock infrastructure supports both unit testing and end-to-end debugging workflow validation

This directory provides a complete testing foundation for debugging tools, enabling comprehensive validation of debugger functionality across multiple languages, debugging scenarios, and integration patterns.