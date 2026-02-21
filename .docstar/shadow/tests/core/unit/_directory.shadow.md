# tests\core\unit/
@children-hash: dd64b9723c73a62a
@generated: 2026-02-21T08:29:08Z

## Overall Purpose and Responsibility

The `tests/core/unit` directory provides comprehensive unit test coverage for all core components of the debugMCP system. It serves as the primary validation layer ensuring type safety, protocol compliance, and functional correctness across the entire debug adapter ecosystem. This test suite acts as both quality assurance and living documentation for the system's architectural contracts.

## Key Components and Integration

### Multi-Layer Testing Architecture

The directory is organized into five specialized testing domains that collectively validate the entire core system:

1. **Protocol Foundation (`adapters/`)** - Tests the foundational debug adapter interface contracts, ensuring type safety and protocol compliance across 20+ debug features
2. **Dependency Injection (`factories/`)** - Validates factory patterns for creating proxy managers and session stores with mock infrastructure for test isolation
3. **MCP Server Layer (`server/`)** - Comprehensive end-to-end testing of the DebugMcpServer including tool execution, session management, and server lifecycle
4. **Session Management (`session/`)** - Complete validation of SessionManager workflows, state transitions, error recovery, and multi-session scenarios
5. **Runtime Safety (`utils/`)** - Tests critical utility functions providing type guards, API migration compliance, and data validation at system boundaries

### Component Interdependencies

The test suites work together to validate the complete data flow:
- **Adapters** define the protocol contracts that **Session** components must implement
- **Factories** provide the dependency injection patterns that **Server** components rely on
- **Server** orchestrates the **Session** management through validated **Utils** safety mechanisms
- **Utils** provide the runtime type safety that protects all other components at system boundaries

## Public API Surface and Entry Points

### Core Testing Entry Points

**Protocol Validation**
- Debug adapter interface contract testing (AdapterState, AdapterErrorCode, DebugFeature enums)
- Error handling patterns and recovery mechanisms
- Type safety enforcement across debug protocol features

**Factory Pattern Testing** 
- `IProxyManagerFactory.create()` and `ISessionStoreFactory.create()` validation
- Mock infrastructure for isolated component testing
- Dependency injection integrity verification

**MCP Server Operations**
- 14 core MCP tools including session management, debugging control, and runtime inspection
- Dynamic language discovery and adapter registry integration  
- Server lifecycle management (startup, shutdown, cleanup)

**Session Lifecycle Management**
- Complete debug workflow testing (creation → debugging → termination)
- Multi-session concurrency and state isolation
- DAP protocol operations and error recovery

**Runtime Safety Utilities**
- Type guards for critical data structures (`isValidAdapterCommand`, `validateProxyInitPayload`)
- API migration compliance (deprecated `pythonPath` to `executablePath`)
- Serialization safety and performance validation

## Internal Organization and Data Flow

### Testing Strategy Patterns

**Mock-First Architecture**: All test suites use comprehensive mock dependencies for isolation, enabling focused unit testing without external system dependencies.

**Contract-Driven Testing**: Tests validate interface contracts first, then implementation behavior, ensuring consistent API adherence across components.

**State Machine Validation**: Extensive testing of state transitions, particularly in session management, ensuring robust lifecycle handling.

**Error Resilience**: Systematic validation of error scenarios, timeout handling, and graceful degradation patterns.

### Cross-Component Validation Flow

1. **Foundation Layer**: Adapter interface tests ensure protocol contracts are sound
2. **Creation Layer**: Factory tests validate dependency injection and instance management  
3. **Orchestration Layer**: Server tests verify MCP protocol implementation and tool execution
4. **Management Layer**: Session tests validate complete debug workflows and state management
5. **Safety Layer**: Utils tests ensure runtime type safety and API consistency

## Important Patterns and Conventions

### Consistent Testing Infrastructure
- Vitest framework with fake timers and comprehensive mocking
- Centralized mock utilities (`server-test-helpers.ts`, `session-manager-test-utils.ts`)
- Proper test isolation with `beforeEach/afterEach` cleanup patterns

### Error Handling Standards
- Two-tier error response patterns (MCP protocol errors vs operational errors)
- Comprehensive edge case coverage with graceful degradation
- Memory leak prevention through proper cleanup validation

### Platform Compatibility
- Environment-agnostic testing for cross-platform support
- Path resolution testing across different operating systems
- Dynamic language discovery and adapter integration

This unit test directory ensures the debugMCP core system is robust, type-safe, and maintains consistent behavior across all supported debugging scenarios and failure modes. It serves as the definitive validation layer for system reliability and protocol compliance.