# tests/core/unit/factories/
@generated: 2026-02-11T23:47:40Z

## Purpose

This directory contains comprehensive unit tests for factory pattern implementations in the debug proxy system's core module. It validates factory classes responsible for creating ProxyManager and SessionStore instances, along with their corresponding mock implementations used for testing.

## Key Components and Architecture

### Factory Pattern Implementation
The directory tests two main factory types:
- **ProxyManagerFactory**: Creates instances of ProxyManager for handling debug proxy operations
- **SessionStoreFactory**: Creates instances of SessionStore for managing debug session state

### Mock Factory Infrastructure
Each production factory has a corresponding mock implementation for testing:
- **MockProxyManagerFactory**: Provides test-friendly ProxyManager creation with state tracking
- **MockSessionStoreFactory**: Creates MockSessionStore instances with call monitoring capabilities

## Test Coverage Areas

### Core Factory Behavior Validation
- **Instance Creation**: Verifies factories create correct types with proper interfaces
- **Independence**: Ensures each factory call produces unique, isolated instances
- **Statelessness**: Confirms factories don't retain references to created instances
- **Dependency Injection**: Validates proper parameter passing and adapter support

### Mock Factory Testing Features
- **State Tracking**: Mock factories maintain arrays of created instances for test introspection
- **Call Monitoring**: Mock implementations track method invocations with parameter capture
- **Error Resilience**: Mock factories handle exceptions while maintaining tracking state
- **Test Isolation**: Independent mock factory instances maintain separate state

## Public API Surface

### Entry Points
- **ProxyManagerFactory.create(adapter?)**: Creates ProxyManager instances with optional IDebugAdapter
- **SessionStoreFactory.create(params)**: Creates SessionStore instances with CreateSessionParams
- **MockProxyManagerFactory.create(adapter?)**: Creates tracked ProxyManager mocks
- **MockSessionStoreFactory.create(params)**: Creates MockSessionStore with call tracking

### Interface Compliance
All factories implement their respective interfaces:
- `IProxyManagerFactory` for proxy management
- `ISessionStoreFactory` for session storage
- Mock factories extend base functionality with testing utilities

## Internal Organization and Data Flow

### Test Structure Pattern
Each test file follows a consistent organization:
1. **Dependency Setup**: Mock helpers and test utilities
2. **Production Factory Tests**: Core functionality validation
3. **Mock Factory Tests**: Testing infrastructure verification
4. **Integration Tests**: End-to-end factory behavior

### Data Flow Validation
Tests ensure proper parameter flow from factory methods through to created instances, with particular attention to:
- Adapter parameter passing in ProxyManager creation
- Session parameter handling in SessionStore creation
- State isolation between factory instances
- Dependency integrity across multiple factory calls

## Important Patterns and Conventions

### Testing Strategies
- **Type Safety**: Extensive interface compliance checking with `toBeTypeOf('function')`
- **Instance Isolation**: Reference inequality testing with `not.toBe()`
- **State Verification**: Deep parameter comparison and call history validation
- **Mock Introspection**: State tracking arrays for test verification

### Error Handling
- Mock factories throw descriptive errors when not properly initialized
- Tests verify error conditions don't corrupt factory state
- Adapter parameter validation ensures proper null handling

### Framework Integration
- Uses Vitest framework for all test implementations
- Leverages `vi.fn()` for comprehensive mock spy functionality
- Implements proper test lifecycle with setup/teardown patterns

This test suite ensures the factory pattern implementations are robust, maintainable, and provide reliable interfaces for the broader debug proxy system while offering comprehensive mock utilities for testing dependent components.