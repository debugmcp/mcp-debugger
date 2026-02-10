# tests/test-utils/helpers/test-setup.ts
@source-hash: d1b6360bcc3cf79f
@generated: 2026-02-09T18:14:40Z

## Purpose
Test setup utilities module that provides factory functions for creating test instances of SessionManager and related components with mock dependencies. Enables isolated unit testing by standardizing mock creation patterns.

## Key Functions

### `createTestSessionManager` (L30-66)
Primary factory function that creates a SessionManager instance with mocked dependencies:
- **Parameters**: `overrides` (partial dependency overrides), `config` (SessionManager config)
- **Returns**: Object containing sessionManager instance, dependencies, and typed factory references
- **Pattern**: Creates base dependencies via `createTestDependencies()`, applies overrides, constructs SessionManager
- **Special handling**: Auto-creates mock environment if not provided (L42-46)

### `createTestSessionStore` (L72-80)
Simple factory for SessionStore instances:
- Creates MockSessionStoreFactory and returns both store and factory
- No configuration options - returns basic test instance

### `createMockProxyManager` (L87-114)
Configurable ProxyManager mock creation:
- **Parameters**: Configuration object with sessionId, isRunning, currentThreadId
- **Behavior**: Can simulate started state (L96-106) and stopped state with thread ID (L108-111)
- **Usage pattern**: Preconfigure mock state before injection into tests

### `createTestSessionManagerWithProxyManager` (L120-143)
Specialized factory for testing ProxyManager interactions:
- Accepts a specific MockProxyManager instance
- Creates custom MockProxyManagerFactory that returns the provided mock
- Useful for testing specific ProxyManager behavior scenarios

### Helper Functions
- `createMockFileSystemWithDefaults` (L148-159): Pre-configured FileSystem mock with common behaviors
- `createMockNetworkManagerWithDefaults` (L164-172): NetworkManager mock with port allocation simulation
- `waitForEvent` (L177-192): Promise-based event waiting utility with timeout
- `simulateProxyManagerLifecycle` (L197-212): Automated ProxyManager event sequence simulation

## Dependencies
- **External**: vitest mocking framework
- **Internal**: SessionManager system, test-dependencies module, factory classes
- **Mock types**: MockProxyManagerFactory, MockProxyManager, MockSessionStoreFactory

## Architecture Patterns
- **Factory pattern**: Consistent `createTest*` naming convention
- **Dependency injection**: All functions accept override parameters
- **Mock composition**: Base dependencies + selective overrides
- **Type safety**: Returns strongly typed mock factory references

## Test Lifecycle Support
The module supports complete test lifecycle management from setup through event simulation, with particular focus on async ProxyManager state transitions and debugging scenarios.