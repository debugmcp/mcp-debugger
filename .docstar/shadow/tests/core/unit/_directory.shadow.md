# tests/core/unit/
@generated: 2026-02-09T18:16:42Z

## Overall Purpose and Responsibility
This directory contains the complete unit test suite for the **DebugMCP Core** system, providing comprehensive validation of all critical debugging components including server functionality, session management, factory patterns, adapter interfaces, and utility functions. The test suite ensures system reliability, type safety, and protocol compliance across the entire Debug Adapter Protocol (DAP) implementation within the Model Context Protocol (MCP) framework.

## Key Components and System Integration

### Core System Coverage
The test suite validates five primary system areas that work together to provide complete debugging functionality:

**Debug Server & MCP Integration** (`server/`)
- Tests the main DebugMCP Server that exposes 14 debugging tools through MCP
- Validates tool registration, server lifecycle, and AI-friendly documentation
- Ensures proper integration between MCP protocol and debugging operations

**Session Management Engine** (`session/`)
- Comprehensive testing of SessionManager class managing debug session lifecycles
- Tests state machine transitions (CREATED → INITIALIZING → PAUSED/RUNNING → STOPPED/ERROR)
- Validates DAP protocol operations, multi-session coordination, and error recovery

**Factory Pattern Infrastructure** (`factories/`)
- Tests factory pattern implementations for ProxyManager and SessionStore creation
- Validates dependency injection, instance independence, and mock framework support
- Ensures proper resource management and testing infrastructure

**Debug Adapter Protocol Types** (`adapters/`)
- Validates complete TypeScript type system for DAP implementation
- Tests adapter state management, error classification, and capability negotiation
- Ensures type safety and contract compliance across debug protocol interfaces

**System Utilities** (`utils/`)
- Tests critical utility functions for session parameter migration and runtime type safety
- Validates IPC communication boundaries and serialization integrity
- Ensures backward compatibility and cross-platform support

### Integration Architecture
The components form a layered testing architecture:

1. **Protocol Layer**: Adapter types and DAP interface validation
2. **Core Logic Layer**: Session management, factory patterns, and utilities
3. **Service Layer**: MCP server integration and tool exposure
4. **Testing Infrastructure**: Mock factories, dependency injection, and test utilities

## Public API Surface and Entry Points

### Primary Test Entry Points
- **Server Tool Interface**: 14 MCP debugging tools (session management, execution control, code inspection)
- **SessionManager API**: Session lifecycle methods, DAP operations, and state management
- **Factory Interfaces**: ProxyManagerFactory and SessionStoreFactory with mock counterparts
- **Type System**: Complete DAP type validation and adapter interface compliance
- **Utility Functions**: Session migration, type guards, and serialization utilities

### Key Testing Patterns
- **Comprehensive Mocking Strategy**: All external dependencies isolated through mock factories
- **State Machine Validation**: Session lifecycle and adapter state transition testing
- **Protocol Compliance**: DAP specification adherence and MCP tool interface validation
- **Cross-Platform Support**: Windows/Unix path handling and platform-specific defaults
- **Memory Safety**: Event listener cleanup and resource leak prevention

## Internal Organization and Data Flow

### Test Infrastructure Dependencies
- **Vitest Framework**: Primary testing with fake timers and comprehensive mocking
- **Mock Ecosystem**: Centralized mock factories (server-test-helpers, session-manager-test-utils)
- **TypeScript Integration**: Compile-time type checking and interface validation
- **Dependency Injection**: Consistent mock strategy across all test suites

### Critical System Boundaries Tested
- **MCP Protocol Interface**: Tool registration, parameter validation, and response formatting
- **DAP Communication**: Adapter command validation and protocol message handling
- **IPC Boundaries**: Serialization safety and inter-process communication
- **Multi-Session Coordination**: Session isolation and concurrent debugging support
- **Error Recovery**: Graceful degradation and system resilience

### Data Flow Validation
Tests ensure proper data flow through the complete debugging pipeline:
1. **MCP Tool Invocation** → Parameter validation → **SessionManager operations**
2. **Session State Management** → DAP protocol communication → **Debug adapter interaction**
3. **Factory Pattern** → Dependency injection → **Component instantiation**
4. **Type Safety** → Runtime validation → **Safe IPC communication**

## Testing Framework Conventions
- **Isolation Principle**: Each test suite operates in complete isolation with mocked dependencies
- **Behavioral Verification**: Mock function calls and state verification patterns
- **Edge Case Coverage**: Comprehensive testing of error conditions, boundary cases, and race conditions
- **Performance Validation**: Memory leak prevention and scalability testing
- **Documentation Standards**: AI-friendly tool documentation with environment-agnostic guidance

This test directory serves as the quality assurance foundation for the entire DebugMCP system, ensuring reliable debugging functionality, protocol compliance, and system integrity across all supported languages and environments.