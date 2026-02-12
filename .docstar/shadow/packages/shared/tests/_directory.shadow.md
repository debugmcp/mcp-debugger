# packages\shared\tests/
@generated: 2026-02-12T21:05:56Z

## Purpose and Scope

This directory contains comprehensive test suites for the shared library's debug adapter policy implementations. It validates the critical translation and management layer that enables Debug Adapter Protocol (DAP) compliance across multiple programming languages, focusing on JavaScript/Node.js and Rust debugging environments.

## Core Components and Organization

### Unit Test Suite (`unit/`)
The primary testing component containing language-specific adapter policy tests:

- **JavaScript Debug Adapter Tests** (`adapter-policy-js.spec.ts`) - Validates `JsDebugAdapterPolicy` for Node.js debugging through js-debug adapter
- **Rust Debug Adapter Tests** (`adapter-policy-rust.test.ts`) - Tests `RustAdapterPolicy` for Rust debugging via CodeLLDB integration

These tests work together to ensure consistent debugging experiences across different language ecosystems while maintaining strict DAP protocol compliance.

## Key Testing Areas

### Debug Adapter Protocol (DAP) Validation
- Command sequencing and state management during debug session lifecycle
- Proper handling of initialization flows (`initialize` → `launch` → `configurationDone`)
- Reverse debugging capabilities and child session creation
- Protocol compliance across language-specific implementations

### Language-Specific Adapter Logic
- **JavaScript**: Internal frame filtering, variable scope management, adapter process detection
- **Rust**: Executable resolution via `CARGO_PATH`, binary validation, CodeLLDB integration
- Cross-platform compatibility and environment-specific behavior

### Core Debug Functionality
- Stack frame processing and variable extraction
- Filtering of internal/special debug variables
- Session state transitions and error handling
- Child process management and DAP communication

## Testing Infrastructure and Patterns

### Mock-Based Architecture
- Comprehensive file system operation mocking (`fs/promises`)
- Child process simulation with event-driven testing
- Platform simulation for cross-platform validation
- Type-safe DAP protocol mock implementations

### Test Utilities and Helpers
- Mock creation utilities for stack frames and debug variables
- Cross-platform testing with environment manipulation
- Test isolation through systematic mock reset patterns
- Helper functions maintaining API contract compliance

## Integration Role

This test suite validates the adapter policy layer that serves as the critical bridge between:

**Upstream**: Debug session management, IDE integration, and user debugging requests
**Downstream**: Language-specific debug adapters (js-debug, CodeLLDB) and target application processes

The policies tested here handle the essential translation, filtering, and management logic that enables seamless multi-language debugging while abstracting away language-specific implementation details.

## Key Testing Patterns

- Event-driven asynchronous operation testing
- State transition validation for complex debug flows
- Platform-agnostic testing with environment simulation
- Comprehensive edge case and error condition coverage
- Type-safe mocking preserving original API semantics

This test directory ensures the reliability and consistency of the debug adapter policy layer, which is fundamental to providing a unified debugging experience across different programming languages and development environments.