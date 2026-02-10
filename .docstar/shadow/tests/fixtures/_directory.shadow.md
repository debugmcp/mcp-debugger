# tests/fixtures/
@generated: 2026-02-09T18:16:37Z

## Purpose and Responsibility
The `tests/fixtures` directory serves as a comprehensive test fixture library providing controlled debugging scenarios across multiple programming languages and execution environments. It contains minimal, predictable test programs designed to validate debugger functionality, Debug Adapter Protocol (DAP) implementations, and development tool integrations through standardized debugging workflows.

## Key Components and Architecture

### Multi-Language Debug Targets
- **Python fixtures** (`python/`): Simple debugging targets with clear breakpoint locations and mock DAP server implementation
- **JavaScript/TypeScript fixtures** (`javascript-e2e/`): ESM-compatible debugging scenarios including async patterns, TypeScript compilation, and worker threads
- **Debug scripts** (`debug-scripts/`): Cross-language minimal scripts for basic debugging flow validation

### Mock Infrastructure Components
- **DAP Server Mock** (`python/debugpy_server.py`): Lightweight Debug Adapter Protocol server for testing client-server debugging workflows
- **JavaScript Mock Adapter** (`debug-scripts/simple-mock.js`): Mock script for JavaScript adapter path resolution testing

### Specialized Testing Scenarios
- **Error handling fixtures**: Deliberate runtime errors (ZeroDivisionError, unhandled exceptions) for exception debugging validation
- **Async debugging patterns**: Promise-based execution flows and multi-threaded worker communication
- **Variable inspection targets**: Different data types and nested scope scenarios for debugger state examination

## Public API Surface

### Primary Entry Points
- **`python/debug_test_simple.py`**: Basic Python debugging target with documented breakpoint locations
- **`javascript-e2e/simple.js`**: ESM-compatible JavaScript debugging with async/await patterns
- **`javascript-e2e/app.ts`**: TypeScript debugging workflow requiring compilation and source map validation
- **`javascript-e2e/worker.js`**: Multi-threaded debugging scenarios using Node.js worker threads

### Mock Testing Infrastructure
- **`python/debugpy_server.py`**: Configurable DAP mock server (port configuration, connection handling)
- **Various error-generating scripts**: Predictable failure scenarios for exception handling testing

## Internal Organization and Data Flow

### Standardized Testing Patterns
All fixtures implement consistent debugging markers:
- **Breakpoint indicators**: `BREAK_HERE` comments and documented line numbers
- **Predictable execution flows**: Linear, minimal complexity for reliable testing
- **Observable checkpoints**: Console output and variable states for verification
- **Self-contained design**: No external dependencies, isolated test environments

### Cross-Language Consistency
- **Unified breakpoint conventions**: Standardized comment markers across Python and JavaScript
- **Similar execution patterns**: Main function entry points with clear control flow
- **Consistent error scenarios**: Comparable exception types and handling patterns

### Integration Architecture
1. **Debug targets** execute as standalone programs with predictable behavior
2. **Mock servers** simulate debugging infrastructure for protocol testing
3. **Test coordination** through standardized breakpoint locations and execution markers
4. **Multi-environment support** covering synchronous, asynchronous, and multi-threaded scenarios

## Testing Use Cases
This fixture library enables validation of:
- **Debugger attachment and detachment workflows**
- **Breakpoint placement accuracy across languages and execution models**
- **Variable inspection during debugging sessions**
- **Exception handling and error reporting capabilities**
- **Debug Adapter Protocol compliance and communication**
- **Source map accuracy for compiled languages (TypeScript)**
- **Multi-threaded and async debugging scenarios**

The directory provides a complete testing foundation for debugging tools, IDE integrations, and development environments requiring comprehensive validation across diverse programming languages and execution contexts.