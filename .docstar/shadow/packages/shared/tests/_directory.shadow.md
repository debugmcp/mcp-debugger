# packages/shared/tests/
@generated: 2026-02-11T23:47:54Z

## Purpose
This directory contains the comprehensive test suite for the MCP debugging framework's adapter policy layer. It validates language-specific Debug Adapter Protocol (DAP) implementations that manage debugging sessions across different programming languages through standardized protocol communication.

## Key Components and Organization

### Unit Test Suite (`unit/`)
The core testing infrastructure focuses on two primary language-specific adapter policies:
- **JavaScript/Node.js Adapter Policy Tests**: Validates `JsDebugAdapterPolicy` functionality including process management, variable filtering, and js-debug adapter integration
- **Rust Adapter Policy Tests**: Validates `RustAdapterPolicy` behavior covering executable resolution, CodeLLDB integration, and Cargo toolchain support

## Testing Architecture and Patterns

### Comprehensive Mock Strategy
The test suite employs sophisticated mocking patterns using vitest to isolate components:
- File system operations and child process spawning
- External adapter binaries and toolchain dependencies
- Platform-specific behaviors through `process.platform` manipulation
- DAP protocol message flows and state transitions

### Cross-Platform Validation
Tests ensure adapter policies work correctly across different operating systems and architectures through:
- Platform simulation for Windows, macOS, and Linux scenarios
- Architecture-specific binary resolution testing
- Executable validation across different file system layouts

### DAP Protocol Compliance
All tests validate adherence to the Visual Studio Code Debug Adapter Protocol using `@vscode/debugprotocol` types, ensuring proper:
- Command queue management and message sequencing
- Session state tracking through initialization phases
- Variable and stack frame data structure compliance

## Core Functionality Areas

### Variable Management System
Tests validate sophisticated variable extraction and filtering capabilities:
- Local variable extraction with configurable internal variable filtering
- Debugger-specific variable exclusion (e.g., `this`, `__proto__` in JavaScript)
- Stack frame processing with fallback mechanisms for incomplete data

### Executable and Process Management
Comprehensive testing of adapter binary discovery and process spawning:
- Environment variable-based executable resolution
- Binary validation through version checking and file access verification
- Adapter process configuration and child session management

### Language-Specific Debug Features
Each language adapter is tested for its unique debugging characteristics:
- **JavaScript**: Node.js internal frame filtering, pending target attachment handling
- **Rust**: Cargo workspace integration, CodeLLDB adapter configuration

## Public API Surface

The test suite validates the key public methods that form the adapter policy interface:
- `extractLocalVariables()` - Variable filtering and data extraction
- `buildChildStartArgs()` - Debug session configuration building
- `filterStackFrames()` - Stack trace processing and cleanup
- `matchesAdapter()` - Language/adapter identification logic
- `getAdapterSpawnConfig()` - Process spawning configuration
- `validateExecutable()` - Binary validation and verification
- `resolveExecutablePath()` - Executable location resolution

## Integration Role

This test suite validates the critical adapter policy layer that bridges the MCP debugging framework with language-specific debug adapters. It ensures proper abstraction of DAP protocol complexities while providing language-specific debugging capabilities through a unified interface. The tests guarantee that the adapter policies correctly translate between the framework's generic debugging operations and the specialized requirements of each supported programming language's debug tooling.