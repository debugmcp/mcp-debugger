# packages\shared\tests\unit/
@generated: 2026-02-12T21:05:43Z

## Purpose and Scope

This directory contains comprehensive unit tests for debug adapter policy implementations in the shared library. It validates the behavior of language-specific debugging adapters that manage Debug Adapter Protocol (DAP) sessions for JavaScript/Node.js and Rust development environments.

## Core Components

### JavaScript Debug Adapter Tests (`adapter-policy-js.spec.ts`)
- Tests `JsDebugAdapterPolicy` class functionality for JavaScript/Node.js debugging
- Validates DAP session management, child process handling, and command queueing
- Covers stack frame filtering, variable extraction, and adapter detection
- Tests complex initialization flows and state transitions

### Rust Debug Adapter Tests (`adapter-policy-rust.test.ts`)  
- Tests `RustAdapterPolicy` class for Rust debugging via CodeLLDB
- Validates executable resolution/validation, binary version checking
- Covers platform-specific adapter spawning and cross-platform compatibility
- Tests DAP protocol handling and session state management

## Key Testing Areas

### Debug Adapter Protocol (DAP) Compliance
- Command queueing and ordering during initialization phases
- Proper handling of `initialize`, `launch`, and `configurationDone` sequences
- State management throughout debug session lifecycle
- Reverse debugging request handling and child session creation

### Language-Specific Functionality
- **JavaScript**: Internal Node.js frame filtering, variable scope handling, adapter process detection
- **Rust**: Executable path resolution via `CARGO_PATH`, binary validation through version checks, CodeLLDB integration

### Cross-Platform Support
- Platform detection and adapter path resolution
- Environment variable handling and executable validation
- Mock-based testing for different operating systems and architectures

### Variable and Stack Management
- Local variable extraction from debug scopes
- Filtering of internal/special variables (`this`, `__proto__`, internals)
- Stack frame processing and fallback handling
- Optional inclusion of special debugging variables

## Testing Infrastructure

### Mock Strategy
- Comprehensive mocking of file system operations (`fs/promises`)
- Child process simulation with event-driven testing
- Platform simulation through `process.platform` manipulation
- DAP protocol mock implementations maintaining type safety

### Test Utilities
- Helper functions for creating mock stack frames and variables
- Cross-platform testing utilities with temporary environment changes
- Mock reset patterns ensuring test isolation
- Type-safe mock implementations preserving original API contracts

## Integration Points

These tests validate the adapter policy layer that sits between:
- **Upper Layer**: Debug session management and IDE integration
- **Lower Layer**: Actual debug adapters (js-debug, CodeLLDB) and target processes

The policies tested here handle the critical translation and management logic that enables seamless debugging experiences across different language ecosystems while maintaining DAP protocol compliance.

## Key Patterns

- Event-driven testing for asynchronous debug operations
- State transition validation for complex initialization flows
- Platform-agnostic testing with environment simulation
- Extensive edge case coverage including error conditions and fallback behaviors
- Type-safe mocking maintaining protocol compliance