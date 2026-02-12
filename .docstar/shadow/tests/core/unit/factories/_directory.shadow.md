# tests\core\unit\factories/
@generated: 2026-02-12T21:05:45Z

## Directory Overview
This directory contains comprehensive unit tests for the factory pattern implementations in the debug proxy system's core architecture. It validates factory behavior for creating both production instances and mock implementations used in testing scenarios.

## Purpose and Scope
The test suite ensures proper factory pattern implementation for two critical components:
- **ProxyManager factories**: Handle creation of debug proxy managers with optional debug adapter dependencies
- **SessionStore factories**: Manage creation of session storage instances for debug session management

Both factory types follow a consistent pattern with production implementations for runtime use and mock implementations for testing introspection.

## Test Architecture

### Core Components
- **ProxyManagerFactory tests**: Validates stateless factory creating ProxyManager instances with dependency injection
- **MockProxyManagerFactory tests**: Tests mock factory with state tracking capabilities for test verification
- **SessionStoreFactory tests**: Ensures proper SessionStore instance creation with language-specific configurations
- **MockSessionStoreFactory/MockSessionStore tests**: Validates mock implementations with call tracking and parameter capture

### Factory Pattern Validation
All tests verify essential factory behaviors:
- **Instance Creation**: Factories produce correct types with complete interface implementations
- **Independence**: Each factory call returns separate, isolated instances
- **Statelessness**: Production factories maintain no internal state between calls
- **Dependency Injection**: Parameters are properly passed through to created instances

### Mock Testing Infrastructure
Mock factories provide enhanced testing capabilities:
- **State Tracking**: `createdManagers`/`createdStores` arrays maintain creation history
- **Parameter Capture**: `lastAdapter` and `createSessionCalls` preserve invocation details
- **Test Introspection**: Ability to verify factory usage patterns and parameter passing
- **Error Resilience**: State updates occur even when creation functions throw errors

## Test Patterns and Conventions

### Verification Strategies
- Type checking with `toBeInstanceOf()` for inheritance validation
- Method existence verification using `toBeTypeOf('function')`
- Reference inequality testing to ensure instance independence
- Deep parameter comparison for accurate capture validation
- Private property access (via `as any`) for dependency verification

### Test Data and Scenarios
- Uses realistic debug languages (Python, Mock) for comprehensive testing
- Employs varying parameter configurations from minimal to complex
- Tests both successful operations and error conditions
- Validates concurrent usage patterns and state isolation

## Key Dependencies
- **Vitest framework**: Provides test runner, assertions, and mock utilities (`vi.fn()`)
- **Core factory implementations**: ProxyManagerFactory, SessionStoreFactory and their interfaces
- **Mock utilities**: Comprehensive IDebugAdapter mocks with lifecycle and protocol methods
- **Type definitions**: IProxyManager, CreateSessionParams, DebugLanguage enums

## Integration Points
The tests validate the factory system's role in the larger debug proxy architecture by ensuring:
- Proper dependency injection for debug adapters and session parameters
- Correct interface compliance for seamless integration with consuming code
- Mock implementations that accurately mirror production behavior for testing
- State isolation that prevents cross-contamination in multi-instance scenarios

This test suite serves as both validation for the factory implementations and documentation of their expected behavior patterns within the debug proxy system.