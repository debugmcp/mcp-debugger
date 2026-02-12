# tests\core\unit\factories/
@generated: 2026-02-12T21:00:54Z

## Purpose

Unit test directory for factory pattern implementations in the core debug proxy system. Contains comprehensive test suites validating factory behavior, dependency injection, and mock testing utilities for creating proxy managers and session stores.

## Key Components

### Factory Test Suites
- **`proxy-manager-factory.test.ts`**: Tests for `ProxyManagerFactory` and `MockProxyManagerFactory` classes
- **`session-store-factory.test.ts`**: Tests for `SessionStoreFactory` and `MockSessionStoreFactory` classes

Both test suites follow identical patterns for validating factory implementations and their corresponding mock counterparts.

## Test Architecture

### Factory Pattern Testing
- **Production Factories**: Stateless factory implementations that create instances through dependency injection
  - `ProxyManagerFactory`: Creates `ProxyManager` instances with optional `IDebugAdapter` dependencies
  - `SessionStoreFactory`: Creates `SessionStore` instances for session management
- **Mock Factories**: Test-focused factories with state tracking capabilities
  - `MockProxyManagerFactory`: Tracks created managers and adapter parameters
  - `MockSessionStoreFactory`: Maintains arrays of created store instances

### Common Test Patterns

**Instance Creation & Validation**:
- Verifies factories create correct instance types
- Confirms all required interface methods exist
- Validates method signatures and type compliance

**Independence & Isolation**:
- Ensures each factory call returns unique instances
- Tests that factories maintain no internal state
- Confirms proper isolation between created instances

**Mock State Tracking**:
- Tests tracking arrays (`createdManagers`, `createdStores`, `createSessionCalls`)
- Verifies parameter capture and preservation
- Ensures chronological ordering of operations

**Dependency Management**:
- Validates proper dependency injection
- Tests optional parameter handling
- Confirms adapter/parameter passing to created instances

## Testing Utilities

### Mock Creation Helpers
- `createMockDebugAdapter()`: Comprehensive IDebugAdapter mock with lifecycle, state management, and DAP protocol methods
- Vitest framework integration with `vi.fn()` for spy functionality
- Setup/teardown patterns for mock state management

### Verification Strategies
- Instance type checking with `toBeInstanceOf()`
- Method existence validation with `toBeTypeOf('function')`
- Reference inequality testing for independence verification
- Deep equality comparison for parameter preservation
- Private property access for internal dependency verification

## Integration Points

These factory tests validate the creation and configuration of core system components:
- **Proxy Management**: Debug adapter integration and proxy lifecycle management
- **Session Management**: Debug session storage and retrieval with language-specific support
- **Mock Testing**: Comprehensive test utilities for factory behavior verification

## Key Conventions

- Stateless production factories with no instance tracking
- Mock factories maintain test state for introspection and verification
- Optional dependency parameters (adapters, configuration)
- Comprehensive interface compliance testing
- Independent instance creation ensuring proper isolation