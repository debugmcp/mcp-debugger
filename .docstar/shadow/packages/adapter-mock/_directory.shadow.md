# packages/adapter-mock/
@generated: 2026-02-09T18:16:34Z

## Purpose and Responsibility

The `packages/adapter-mock` module provides a complete mock debug adapter system designed for testing the DebugMCP framework. It implements a fully functional Debug Adapter Protocol (DAP) simulation environment that allows developers to test debug adapter integrations, protocol implementations, and VS Code debugging workflows without requiring actual runtime environments or external dependencies.

## Key Components and Integration

### Core Architecture
The module follows a layered factory pattern with four primary components working in concert:

- **MockAdapterFactory**: Entry-point factory implementing `IAdapterFactory` that creates adapter instances with dependency injection and configuration validation
- **MockDebugAdapter**: Primary adapter implementation managing debugging state through a permissive state machine and delegating DAP operations to external processes
- **MockDebugAdapterProcess**: Standalone DAP server that runs as a separate process, providing complete protocol simulation including breakpoint management, execution control, and variable inspection
- **DAPConnection**: Low-level protocol handler managing DAP wire protocol with Content-Length framing and message buffering

### Data Flow Integration
1. **Creation**: Factory creates adapter instances with injected dependencies and MockAdapterConfig
2. **Process Management**: Adapter launches separate MockDebugAdapterProcess for DAP protocol simulation
3. **Communication**: DAPConnection handles low-level messaging while the process handles command logic
4. **State Coordination**: Adapter maintains debugging state and manages lifecycle transitions (INITIALIZING → READY → CONNECTED → DEBUGGING)

## Public API Surface

The module exposes a clean, minimal public interface through its main entry points:

**Primary Exports:**
- `MockDebugAdapter` - Main adapter implementation for direct integration
- `MockAdapterFactory` - Factory class for creating adapter instances
- `createMockAdapterFactory()` - Convenience factory function for simplified instantiation

**Configuration Types:**
- `MockAdapterConfig` - Configuration interface controlling timing delays, feature support, and error simulation
- `MockErrorScenario` - Enumeration of testable error conditions (timeouts, crashes, missing executables)

## Key Features and Capabilities

### Configuration-Driven Testing
All mock behavior is controlled through `MockAdapterConfig`, enabling fine-tuned testing scenarios with:
- Customizable timing delays for realistic response patterns
- Probability-based error injection for failure scenario testing
- Feature toggle support for testing different adapter capabilities
- Dual communication modes (stdio and TCP) for various integration patterns

### Comprehensive DAP Simulation
Provides authentic debugging experience with:
- Full DAP protocol implementation including initialization sequences
- Complete breakpoint management and execution control
- Mock file system with `.mock` and `.test` extensions
- Simulated variable scopes, stack frames, and thread management
- Proper DAP capability advertisement and event handling

### Robust Testing Infrastructure
The module includes comprehensive test coverage validating:
- Package exports and factory instantiation (integration tests)
- Adapter lifecycle management and state transitions (unit tests)
- DAP protocol compliance and error scenario handling
- Dependency injection patterns and mock isolation

## Internal Organization

The module maintains clear separation of concerns across layers:
- **Public API Layer**: Clean exports through index file
- **Factory Layer**: Instance creation and validation logic
- **Adapter Layer**: State management and protocol integration coordination
- **Process Layer**: Standalone DAP server implementation
- **Protocol Layer**: Low-level message handling and wire protocol management

This architecture enables comprehensive testing of debug adapter functionality while providing flexible configuration options for various testing scenarios, making it an essential component for validating debugger frameworks and VS Code extension development workflows.