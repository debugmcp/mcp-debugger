# tests\core\unit/
@generated: 2026-02-12T21:06:13Z

## Core Unit Test Suite

This directory contains the comprehensive unit test suite for the debugMCP system's core components, providing complete validation of the debugging infrastructure that enables Model Context Protocol (MCP) debugging capabilities across multiple programming languages.

### Overall Purpose

The `tests/core/unit` directory serves as the primary validation layer for all foundational components of the debugMCP system. It ensures the reliability, correctness, and integration of the core debugging architecture through systematic testing of adapters, factories, server functionality, session management, and utility functions. These tests act as both a safety net for code changes and living documentation of the system's expected behaviors.

### Key Components & Architecture

**Adapter System Validation (`adapters/`)**:
- Validates the foundational debug adapter interface specifications and shared contracts
- Tests lifecycle management (7-state adapter lifecycle), error classification (13 categorized error codes), and feature capabilities (20+ debug protocol features)
- Ensures type safety and interface compliance across the entire debug adapter protocol

**Factory Pattern Testing (`factories/`)**:
- Tests factory implementations for ProxyManager and SessionStore creation
- Validates dependency injection, instance isolation, and mock factory behavior for testing infrastructure
- Ensures proper factory pattern implementation with stateless production factories and stateful mock factories

**MCP Server Validation (`server/`)**:
- Comprehensive testing of the DebugMcpServer with 14 debugging tools organized into session management, execution control, and runtime inspection
- Tests server initialization, lifecycle management, tool registration, and MCP protocol compliance
- Validates language discovery, dynamic tool documentation, and cross-platform compatibility

**Session Management Testing (`session/`)**:
- End-to-end testing of SessionManager, the core debugging session orchestrator
- Validates Debug Adapter Protocol (DAP) operations, state machine integrity, multi-session isolation, and error recovery
- Tests memory management, timing control, and graceful degradation scenarios

**Utility Function Testing (`utils/`)**:
- Tests session migration validation ensuring smooth API transitions (deprecated `pythonPath` to `executablePath`)
- Comprehensive type guard validation for runtime safety at IPC and serialization boundaries
- Performance benchmarks and error handling for critical data validation functions

### Public API Surface & Integration Points

The test suite validates the complete public API of the debugMCP system:

**Core MCP Tools** (14 debugging tools):
- Session Management: create_debug_session, list_debug_sessions, close_debug_session
- Execution Control: start_debugging, set_breakpoint, step_over/into/out, continue/pause_execution
- Runtime Inspection: get_variables, get_stack_trace, get_scopes, evaluate_expression

**Factory Interfaces**:
- ProxyManagerFactory and SessionStoreFactory with dependency injection
- Mock implementations with state tracking for test scenarios

**Session Management**:
- Complete session lifecycle from creation through debugging operations to cleanup
- State machine management and DAP operation handling
- Multi-language support and cross-platform compatibility

### Internal Organization & Data Flow

The test architecture follows a layered validation approach:

1. **Foundation Layer**: Adapter interface and type system validation ensures protocol correctness
2. **Creation Layer**: Factory pattern testing ensures proper component instantiation and dependency injection  
3. **Service Layer**: Server and session manager testing validates core business logic and workflows
4. **Safety Layer**: Utility testing ensures data integrity and API migration safety

### Testing Patterns & Conventions

**Comprehensive Mock Strategy**:
- Centralized mock factories (`server-test-helpers.ts`, `session-manager-test-utils.ts`) ensure consistency
- Fake timers enable deterministic testing of async operations and race conditions
- Strategic failure injection tests error handling and recovery scenarios

**Validation Approaches**:
- Integration-style testing validating component interactions
- State machine integrity testing with proper transition validation
- Cross-platform compatibility testing for Windows/Unix environments
- Memory leak prevention and resource cleanup validation

**Error Handling Evolution**:
- Tests validate architectural decisions around error propagation vs. success responses with error messages
- Comprehensive boundary testing for valid/invalid inputs
- Structured error reporting with detailed context validation

### Critical System Role

This unit test suite serves as the cornerstone of quality assurance for the debugMCP system by:
- **Protocol Compliance**: Ensuring adherence to Debug Adapter Protocol and MCP specifications
- **Integration Safety**: Validating component interactions and data flow integrity
- **Evolution Support**: Testing API migrations and backward compatibility
- **Operational Reliability**: Validating error handling, recovery mechanisms, and resource management

The tests collectively ensure that the debugMCP system can reliably orchestrate debugging sessions across multiple programming languages while maintaining protocol compliance, error resilience, and cross-platform compatibility.