# packages/shared/tests/
@generated: 2026-02-10T21:26:26Z

## Purpose
This directory provides comprehensive unit test coverage for the shared debugging infrastructure's language-specific debug adapter policies. It validates Debug Adapter Protocol (DAP) compliance and ensures robust cross-platform debugging capabilities for JavaScript/Node.js and Rust development environments.

## Key Components and Integration

### Test Structure
- **`unit/`** subdirectory containing focused unit tests for debug adapter policy implementations
- Language-specific test suites for JavaScript (`adapter-policy-js.spec.ts`) and Rust (`adapter-policy-rust.test.ts`) debug adapters
- Comprehensive DAP protocol compliance validation across multiple debugging scenarios

### Component Relationships
The test suite validates the integration between:
- Debug adapter policy classes and the DAP command queue management system
- Language-specific debugging features with the shared session state infrastructure
- Platform abstraction layers with actual debugger binaries and toolchains
- External dependencies (`@vscode/debugprotocol`, `@debugmcp/shared`) with internal implementations

## Testing Architecture

### Common Testing Patterns
- **Mock-First Strategy**: Extensive vitest mocking of file system operations, child processes, and external dependencies
- **Cross-Platform Validation**: Platform simulation and temporary environment overrides for comprehensive compatibility testing
- **Event-Driven Testing**: Asynchronous operation validation through event-driven patterns
- **State Lifecycle Testing**: Full debug session lifecycle validation from initialization through termination

### Quality Assurance Coverage
- **DAP Protocol Compliance**: Command queueing, state transitions, and reverse debugging request handling
- **Language Integration**: JavaScript Node.js internal filtering and Rust Cargo toolchain integration
- **Infrastructure Robustness**: Adapter spawning, environment configuration, and error recovery mechanisms
- **Cross-Platform Compatibility**: Platform-specific path resolution and process management

## Public API Validation
Tests validate the public interfaces of:
- `JsDebugAdapterPolicy` for JavaScript/Node.js debugging sessions
- `RustAdapterPolicy` for Rust debugging via CodeLLDB
- Debug session management and DAP command queue coordination
- Variable extraction and stack frame filtering capabilities

## System Integration Points
Ensures proper integration with:
- VSCode Debug Adapter Protocol specifications
- Platform-specific debugger binaries (Node.js debugger, CodeLLDB)
- External build systems (Cargo for Rust projects)
- Cross-platform file system and process APIs

This test directory serves as the quality gate ensuring the shared debugging infrastructure maintains protocol compliance, cross-platform compatibility, and robust error handling across all supported programming languages.