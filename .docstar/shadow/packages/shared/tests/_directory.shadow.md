# packages\shared\tests/
@children-hash: f0b43fe7b309e2dd
@generated: 2026-02-15T09:01:40Z

## Shared Testing Infrastructure for Debug Adapter Framework

This directory houses the testing infrastructure for a multi-language debug adapter system that enables debugging across JavaScript/Node.js and Rust environments through the Debug Adapter Protocol (DAP). It serves as the quality assurance layer ensuring reliable debugging experiences across different programming languages and platforms.

## Overall Purpose and Responsibility

The testing module validates the core debug adapter policy framework that bridges IDE debugging clients with language-specific debug engines. It ensures proper session management, protocol compliance, and resource handling across diverse debugging scenarios while maintaining cross-platform compatibility.

## Key Components and Integration

### Unit Testing Suite (`unit/`)
Contains comprehensive test coverage for debug adapter policies:

- **JavaScript Adapter Testing**: Validates `JsDebugAdapterPolicy` for Node.js debugging sessions, including child process management, stack frame filtering, and command queue orchestration
- **Rust Adapter Testing**: Verifies `RustAdapterPolicy` for CodeLLDB-based debugging, focusing on executable resolution, platform-specific adapter spawning, and binary validation

Both test suites work together to ensure consistent debugging behavior across language boundaries, sharing common testing patterns and validation strategies.

## Public API Surface

### Core Testing Coverage
- **Session Lifecycle Management**: Connection establishment, initialization sequences, and proper state transitions
- **Protocol Compliance**: DAP command processing, response handling, and standard adherence validation  
- **Variable and Stack Management**: Local variable extraction, stack frame filtering, and scope handling
- **Cross-Platform Validation**: Platform-specific behavior testing and adapter detection mechanisms

### Entry Points for Testing
- Language-specific adapter policy validation
- Session management workflow testing
- Protocol communication pattern verification
- Error handling and fallback behavior validation

## Internal Organization and Data Flow

### Testing Architecture
The module employs a unified testing approach using Vitest with extensive mocking capabilities:

- **Mock Strategy**: Comprehensive simulation of file systems, child processes, and external dependencies
- **Type Safety**: Maintains original API contracts while providing controllable test environments
- **Event-Driven Testing**: Validates asynchronous debugging session workflows and state transitions

### Common Testing Patterns
- Setup/teardown workflows with proper mock cleanup
- Shared utilities for mock data generation (stack frames, variables, processes)
- Platform simulation for cross-platform compatibility testing
- Edge case validation for robust error handling

## Data Flow Validation

The tests ensure proper communication flow between:
1. **Debug Clients** (IDEs) sending DAP commands
2. **Adapter Policy Layer** (the system under test) managing sessions and protocol translation
3. **Language Debug Engines** (Node.js debugger, CodeLLDB) executing actual debugging operations

## Important Patterns and Conventions

### Testing Standards
- **Protocol Adherence**: Heavy use of `@vscode/debugprotocol` types for DAP compliance
- **Isolation**: Each test suite maintains independent mock environments
- **Comprehensive Coverage**: Tests cover happy paths, error conditions, and edge cases
- **State-Based Validation**: Complex workflow testing through state transition verification

### Quality Assurance Focus
The testing infrastructure prioritizes reliability, cross-platform consistency, and protocol compliance to ensure the debug adapter framework can handle real-world debugging scenarios across multiple programming languages and development environments.