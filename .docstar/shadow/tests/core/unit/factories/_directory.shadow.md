# tests/core/unit/factories/
@generated: 2026-02-10T21:26:35Z

## Purpose

Unit test suite for factory pattern implementations in the debug proxy system's core architecture. This directory validates factory classes responsible for creating proxy managers and session stores, ensuring proper dependency injection, instance management, and mock testing capabilities.

## Test Coverage Architecture

### Factory Pattern Validation
The tests comprehensively validate two distinct factory implementations:

**ProxyManagerFactory Testing** (`proxy-manager-factory.test.ts`)
- Production factory for creating `ProxyManager` instances with `IDebugAdapter` dependencies
- Mock factory (`MockProxyManagerFactory`) with state tracking for test introspection
- Validates stateless factory behavior and proper dependency injection

**SessionStoreFactory Testing** (`session-store-factory.test.ts`) 
- Production factory for creating `SessionStore` instances for debug session management
- Mock factory (`MockSessionStoreFactory`) with instance tracking capabilities
- Mock store (`MockSessionStore`) with comprehensive call history tracking

### Key Testing Patterns

**Factory Behavior Validation:**
- Instance creation and type correctness
- Instance independence and isolation
- Stateless factory operation (no retained references)
- Dependency integrity across multiple factory calls
- Interface compliance and method availability

**Mock Testing Infrastructure:**
- State tracking for test introspection (`createdManagers`, `createdStores` arrays)
- Call history preservation (`createSessionCalls` tracking)
- Parameter capture and preservation
- Factory independence testing
- Error handling and resilience validation

### Test Organization

**Common Test Structure:**
- Mock dependency creation with comprehensive method stubbing
- Setup/teardown lifecycle management with Vitest framework
- Type checking using `toBeInstanceOf()` and `toBeTypeOf()` patterns
- Reference inequality validation for instance independence
- Deep parameter equality verification

**Mock Utilities:**
- `createMockDebugAdapter()`: Full-featured IDebugAdapter mock with DAP protocol support
- Comprehensive EventEmitter method stubbing for lifecycle management
- Support for multiple debug languages (Python, Mock) in test scenarios

### Integration Points

**System Dependencies:**
- Interfaces with `IProxyManager` and `IDebugAdapter` for proxy management
- Integrates with `SessionStore` and session management subsystems  
- Uses `DebugLanguage` enum for language-specific debug scenarios
- Supports `CreateSessionParams` for session configuration

**Testing Framework:**
- Vitest-based test execution with spy functionality (`vi.fn()`)
- Private property access patterns for dependency verification
- Comprehensive error scenario coverage and edge case handling

## Architecture Insights

The test suite validates a clean separation between production factories (stateless, dependency-injecting) and mock factories (stateful, tracking-enabled). This architecture enables both reliable production behavior and comprehensive testing capabilities through the same factory interfaces.

The factories serve as the primary entry points for creating debug system components, with proper isolation ensuring system modularity and testability. Mock implementations provide essential introspection capabilities for validating complex debug workflows and dependency interactions.