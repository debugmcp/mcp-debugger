# packages\shared\tests\unit/
@children-hash: 44c80678aadc388d
@generated: 2026-02-15T09:01:23Z

## Unit Testing Module for Debug Adapter Policies

This directory contains comprehensive unit tests for debug adapter policy implementations that manage different programming language debugging sessions through the Debug Adapter Protocol (DAP). The tests validate core debugging functionality across JavaScript/Node.js and Rust environments.

## Key Components

### JavaScript Debug Adapter Tests (`adapter-policy-js.spec.ts`)
- **Primary Focus**: `JsDebugAdapterPolicy` class testing for JavaScript/Node.js debugging
- **Core Areas**: Child process management, stack frame filtering, variable extraction, command queue orchestration, and DAP client behavior
- **Key Features**: Tests complex initialization flows, command ordering logic, and adapter detection mechanisms

### Rust Debug Adapter Tests (`adapter-policy-rust.test.ts`) 
- **Primary Focus**: `RustAdapterPolicy` class testing for Rust debugging via CodeLLDB
- **Core Areas**: Executable resolution/validation, variable filtering, platform-specific adapter spawning, and protocol handling
- **Key Features**: Cross-platform testing support, mock child process simulation, and binary validation workflows

## Testing Architecture

### Common Patterns
- **Framework**: Both test suites use Vitest with extensive mocking capabilities
- **Protocol Compliance**: Heavy use of `@vscode/debugprotocol` types for DAP standard adherence
- **Mock Strategy**: Comprehensive mocking of file system access, child processes, and external dependencies
- **Type Safety**: Maintains original type signatures while providing controllable test behavior

### Shared Testing Utilities
- Mock stack frame and variable generation helpers
- Platform simulation capabilities for cross-platform validation
- Event-driven testing for asynchronous debug session management
- State transition validation patterns

## Public API Coverage

### Core Functionality Validation
- **Session Management**: Connection establishment, initialization sequences, and state transitions
- **Variable Extraction**: Local variable filtering with configurable inclusion of special variables (`this`, `__proto__`)
- **Command Processing**: DAP command queueing, ordering, and execution flow management
- **Adapter Detection**: Process identification and configuration validation

### Platform-Specific Features
- **JavaScript**: Node.js internal frame filtering, js-debug adapter detection, reverse debugging support
- **Rust**: Cargo executable resolution, CodeLLDB adapter spawning, cross-platform binary validation

## Internal Organization

### Test Structure
- Setup/teardown patterns with mock cleanup between test cases
- Categorized test groups covering distinct functional areas
- Edge case validation (empty frames, missing executables, spawn failures)
- State-based testing for complex debugging workflows

### Data Flow Testing
- Validates end-to-end debugging session lifecycle
- Tests adapter communication patterns and protocol compliance
- Ensures proper error handling and fallback behaviors
- Verifies configuration inheritance and environment variable processing

## Integration Points

The test suites validate the adapter policy layer that sits between:
- **Debug clients** (IDEs, editors) sending DAP commands
- **Language-specific debug engines** (Node.js debugger, CodeLLDB)
- **Session management infrastructure** handling multiple concurrent debugging sessions

This testing module ensures reliable debugging experiences across different programming languages while maintaining protocol compliance and proper resource management.