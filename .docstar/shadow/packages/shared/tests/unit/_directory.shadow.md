# packages/shared/tests/unit/
@generated: 2026-02-10T21:26:13Z

## Purpose
This directory contains comprehensive unit tests for language-specific debug adapter policies within the shared debugging infrastructure. It validates the Debug Adapter Protocol (DAP) implementation for JavaScript/Node.js and Rust debugging environments.

## Key Components

### JavaScript Debug Adapter Tests (`adapter-policy-js.spec.ts`)
- Tests `JsDebugAdapterPolicy` class for JavaScript/Node.js debugging sessions
- Validates DAP command queue management and initialization flows
- Tests stack frame filtering to hide Node.js internals
- Verifies variable extraction from debug scopes
- Tests adapter detection and spawning configuration

### Rust Debug Adapter Tests (`adapter-policy-rust.test.ts`)  
- Tests `RustAdapterPolicy` class for Rust debugging via CodeLLDB
- Validates executable resolution and binary validation through Cargo
- Tests platform-specific adapter configuration and spawning
- Verifies variable filtering and state management

## Testing Architecture

### Common Test Patterns
- **Mock Strategy**: Extensive use of vitest mocking for file system, child processes, and external dependencies
- **Platform Testing**: Cross-platform validation with temporary platform overrides
- **State Management**: Tests for debug session lifecycle and DAP protocol compliance
- **Error Handling**: Both positive and edge case validation

### Shared Test Utilities
- Mock DebugProtocol object creation for stack frames and variables
- Platform simulation helpers for cross-platform testing
- Child process mocking for adapter spawn testing
- Event-driven testing patterns for asynchronous operations

## Key Testing Areas

### DAP Protocol Compliance
- Command queueing and ordering (initialize → configure → launch)
- State transitions during debug session lifecycle
- Reverse debugging request handling
- Adapter ID normalization and matching

### Language-Specific Features
- **JavaScript**: Node.js internal frame filtering, variable scope handling
- **Rust**: Cargo integration, CodeLLDB adapter configuration, binary validation

### Infrastructure Validation  
- Adapter process spawning and configuration
- Environment variable handling and path resolution
- Network settings and connection management
- Error propagation and recovery mechanisms

## Integration Points
Tests validate integration with:
- `@vscode/debugprotocol` for DAP type definitions
- `@debugmcp/shared` for session state management
- Platform-specific file system and process APIs
- External debugger binaries and toolchains

## Quality Assurance
Provides comprehensive test coverage for debug adapter policies ensuring:
- Robust DAP protocol implementation
- Cross-platform compatibility
- Proper error handling and state management  
- Language-specific debugging feature validation