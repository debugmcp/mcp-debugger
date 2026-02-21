# tests\core/
@children-hash: 42eab92b1b07bf43
@generated: 2026-02-21T08:29:20Z

## Overall Purpose and Responsibility

The `tests/core` directory serves as the comprehensive testing foundation for the debugMCP system's core functionality. It provides complete unit test coverage that validates the entire debug adapter ecosystem, ensuring type safety, protocol compliance, and functional correctness across all core components. This directory acts as both a quality assurance layer and living documentation of the system's architectural contracts.

## Key Components and Integration

The directory contains a single comprehensive subdirectory `unit/` that implements a multi-layer testing architecture covering five critical testing domains:

### Testing Architecture Layers

1. **Protocol Foundation Testing** - Validates debug adapter interface contracts and protocol compliance across 20+ debug features
2. **Dependency Injection Testing** - Ensures factory patterns work correctly for proxy managers and session stores with proper mock isolation
3. **MCP Server Layer Testing** - Comprehensive end-to-end validation of DebugMcpServer including tool execution, session management, and server lifecycle
4. **Session Management Testing** - Complete validation of SessionManager workflows, state transitions, error recovery, and multi-session scenarios
5. **Runtime Safety Testing** - Tests critical utility functions providing type guards, API migration compliance, and data validation

### Component Integration Flow

The testing components work together in a hierarchical validation pattern:
- **Protocol contracts** define the interfaces that session components must implement
- **Factory patterns** provide dependency injection that server components rely on
- **Server orchestration** manages sessions through validated utility safety mechanisms
- **Runtime utilities** provide type safety protection for all system boundaries

## Public API Surface and Entry Points

### Core Testing Capabilities

**Protocol Validation**
- Debug adapter interface contract testing (AdapterState, AdapterErrorCode, DebugFeature enums)
- Error handling patterns and recovery mechanisms
- Type safety enforcement across debug protocol features

**System Component Testing**
- Factory pattern validation for `IProxyManagerFactory` and `ISessionStoreFactory`
- 14 core MCP tools testing including session management and debugging control
- Complete session lifecycle testing (creation → debugging → termination)
- Multi-session concurrency and state isolation validation

**Safety and Compliance Testing**
- Runtime type guards for critical data structures
- API migration compliance testing (deprecated `pythonPath` to `executablePath`)
- Serialization safety and performance validation

## Internal Organization and Data Flow

### Testing Strategy Patterns

**Mock-First Architecture**: All tests use comprehensive mock dependencies for isolation, enabling focused unit testing without external system dependencies.

**Contract-Driven Testing**: Tests validate interface contracts first, then implementation behavior, ensuring consistent API adherence.

**State Machine Validation**: Extensive testing of state transitions, particularly in session management workflows.

**Error Resilience**: Systematic validation of error scenarios, timeout handling, and graceful degradation patterns.

### Validation Flow

The testing follows a structured validation flow from foundation to application:
1. **Foundation** - Protocol contracts and adapter interfaces
2. **Creation** - Factory patterns and dependency injection
3. **Orchestration** - MCP server operations and tool execution
4. **Management** - Session workflows and state management
5. **Safety** - Runtime type safety and API consistency

## Important Patterns and Conventions

### Testing Infrastructure Standards
- Vitest framework with fake timers and comprehensive mocking
- Centralized mock utilities for consistent test isolation
- Proper cleanup patterns preventing memory leaks

### Quality Assurance Patterns
- Two-tier error response validation (MCP protocol vs operational errors)
- Cross-platform compatibility testing for environment-agnostic operation
- Comprehensive edge case coverage with graceful degradation testing

This core testing directory ensures the debugMCP system maintains robust, type-safe operation with consistent behavior across all supported debugging scenarios and failure modes, serving as the definitive validation layer for system reliability and protocol compliance.