# tests/core/unit/session/session-manager-test-utils.ts
@source-hash: ebee2466eed91bfe
@generated: 2026-02-10T01:18:59Z

## Purpose
Test utility module providing mock dependencies and setup for SessionManager unit tests. Centralizes mock creation to ensure consistent test isolation and dependency injection patterns across SessionManager test suites.

## Key Functions

### createMockEnvironment(overrides?) (L44-50)
Creates mock IEnvironment implementation with environment variable access. Supports override values for testing different configurations. Returns object with get(), getAll(), and getCurrentWorkingDirectory() methods.

### createMockAdapterRegistry() (L56-58)  
Factory function that delegates to centralized mock adapter registry creation from test utilities. Ensures consistency across all adapter registry mocks in the test suite.

### createMockDependencies() (L63-121)
Primary factory function that creates complete SessionManagerDependencies object with all required mocks:
- MockProxyManager instance (L70)
- Mock file system, logger, network manager via existing test utilities (L71-73)
- Mock environment with default configuration (L73)
- Mock network manager with createServer() and findFreePort() returning 12345 (L75-78)
- Mock proxy manager factory (L80-82)
- Real SessionStoreFactory instance (L84)
- Mock debug target launcher with Python debug target support (L86-92)
- Mock path utilities with basic path operations (L94-101)
- Mock adapter registry (L103)

Returns extended SessionManagerDependencies with additional mock references for test assertions.

## Dependencies
- vitest for mocking functionality
- SessionManager types and dependencies from core module
- Shared mock utilities (MockProxyManager, createMockFileSystem, createMockLogger)
- SessionStoreFactory from factories
- External dependency interfaces (IFileSystem, INetworkManager, etc.)
- @debugmcp/shared for IAdapterRegistry

## Module-Level Mocks
Global vi.mock() calls (L21-39) stub implementation modules and ProxyManager to prevent real system dependencies during testing. ProxyManager mock provides complete interface implementation with resolved promises.

## Architecture Notes
- Follows dependency injection pattern for test isolation
- Provides both individual mock accessors and SessionManagerDependencies interface compliance
- Uses centralized mock creation where possible to maintain consistency
- Mock implementations provide sensible defaults (ports, paths, etc.) for common test scenarios