# packages/shared/tests/unit/
@generated: 2026-02-11T23:47:39Z

## Purpose
This directory contains comprehensive unit tests for language-specific Debug Adapter Protocol (DAP) policies within the MCP debugging framework. It validates the behavior of adapter policy implementations that manage debugging sessions for different programming languages through standardized DAP communication.

## Key Components

### Language-Specific Adapter Policy Tests
- **JavaScript/Node.js Policy Tests** (`adapter-policy-js.spec.ts`): Tests `JsDebugAdapterPolicy` class functionality including child process management, stack frame filtering, variable extraction, and DAP command queue handling
- **Rust Policy Tests** (`adapter-policy-rust.test.ts`): Tests `RustAdapterPolicy` class covering executable resolution/validation, variable filtering, state management, and CodeLLDB adapter integration

## Testing Architecture

### Common Testing Patterns
- **Mock Strategy**: Extensive use of vitest mocking for file system access, child processes, and external dependencies
- **Cross-Platform Testing**: Platform simulation via `process.platform`/`process.arch` manipulation for comprehensive coverage
- **DAP Protocol Compliance**: Uses `@vscode/debugprotocol` types to ensure proper Debug Adapter Protocol adherence
- **State Management Validation**: Tests complex state transitions during debug session lifecycle

### Shared Test Utilities
- Mock object creation helpers for DebugProtocol types (StackFrame, Variables)
- Platform switching utilities for cross-platform test scenarios
- Child process simulation via EventEmitter for spawn behavior testing
- State transition validation helpers

## Core Functionality Areas

### Variable Management
- Local variable extraction with filtering of internal/special variables (`this`, `__proto__`)
- Configurable inclusion/exclusion of debugger internals
- Stack frame processing with fallback mechanisms

### Executable & Process Management
- Adapter process spawning configuration and validation
- Executable path resolution through environment variables and inputs
- Binary validation via version checking and file access verification

### DAP Protocol Handling
- Command queue management with proper initialization flow
- Configuration deferral and runtime injection capabilities
- Adapter identification and matching logic
- Session state tracking and readiness determination

### Language-Specific Features
- **JavaScript**: Node.js internal frame filtering, js-debug adapter integration, pending target attachment
- **Rust**: Cargo toolchain integration, CodeLLDB adapter configuration, platform-specific binary handling

## Integration Points
These tests validate the adapter policy layer that sits between the MCP debugging framework and language-specific debug adapters, ensuring proper:
- DAP command translation and queueing
- Session state management across initialization phases
- Language-specific debugging feature support
- Cross-platform compatibility and adapter discovery

## Public API Testing
The tests validate public methods exposed by adapter policy classes:
- `extractLocalVariables()` - Variable filtering and extraction
- `buildChildStartArgs()` - Child session configuration
- `filterStackFrames()` - Stack trace processing
- `matchesAdapter()` - Adapter identification
- `getAdapterSpawnConfig()` - Process spawning setup
- `validateExecutable()` - Binary validation
- `resolveExecutablePath()` - Executable location