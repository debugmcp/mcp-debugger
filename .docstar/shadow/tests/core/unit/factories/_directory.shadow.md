# tests\core\unit\factories/
@children-hash: 74645a48bde9f1b1
@generated: 2026-02-15T09:01:23Z

## Purpose and Responsibility

This directory contains comprehensive unit tests for the factory pattern implementations used throughout the debug proxy system. It validates the behavior of factory classes responsible for creating proxy managers and session stores, along with their corresponding mock implementations used for testing isolation and verification.

## Key Components and Relationships

### Factory Test Suites
- **ProxyManagerFactory Tests**: Validates factory pattern for creating IProxyManager instances with dependency injection support for IDebugAdapter
- **SessionStoreFactory Tests**: Tests factory pattern for creating SessionStore instances with support for various debug languages and session parameters
- **Mock Factory Tests**: Comprehensive validation of mock implementations that provide state tracking and call history for test scenarios

### Component Integration
The factories work together to support the debug proxy system's dependency injection architecture:
- ProxyManagerFactory creates the core proxy management components
- SessionStoreFactory creates session storage components
- Mock factories enable isolated testing of components that depend on these factories
- Both factory types support optional adapter parameters for flexible configuration

## Test Architecture Patterns

### Factory Pattern Validation
- **Instance Creation**: Verifies factories create correct concrete types
- **Independence**: Ensures each factory.create() returns separate instances
- **Statelessness**: Confirms factories don't retain references to created instances
- **Dependency Integrity**: Validates consistent dependency injection across instances

### Mock Testing Infrastructure
- **State Tracking**: Mock factories maintain arrays of created instances for test verification
- **Call History**: Mock implementations track method invocations with parameter preservation
- **Test Isolation**: Separate mock instances maintain independent state
- **Error Resilience**: Mock factories continue tracking even when creation functions throw

## Public API Surface

### Core Factory Interfaces
- `IProxyManagerFactory.create(adapter?: IDebugAdapter)`: Creates proxy manager instances
- `ISessionStoreFactory.create(params: CreateSessionParams)`: Creates session store instances

### Mock Testing Utilities
- `MockProxyManagerFactory`: Provides createFn injection and instance tracking
- `MockSessionStoreFactory`: Tracks created stores in createdStores array
- `MockSessionStore`: Extends SessionStore with createSessionCalls tracking

## Internal Organization

### Test Structure
- Comprehensive mock helper functions for creating test dependencies
- Grouped test suites by factory type and behavior category
- Systematic validation of factory contracts and mock capabilities
- Integration tests that verify real-world usage scenarios

### Data Flow
1. Factories receive configuration parameters and optional adapters
2. Factories create instances using dependency injection
3. Mock factories additionally track creation calls and maintain state
4. Test suites verify both functional behavior and tracking capabilities

## Important Conventions

### Testing Patterns
- Uses Vitest framework with comprehensive assertion coverage
- Employs private property access (`as any` casting) for dependency verification
- Implements realistic test scenarios with actual debug languages (Python)
- Maintains strict separation between production factory tests and mock factory tests

### Mock Implementation Standards
- Mock factories implement same interfaces as production factories
- State tracking is additive - doesn't interfere with base functionality
- Parameter preservation maintains exact object references for verification
- Error handling continues tracking even in failure scenarios

This test directory ensures the factory pattern implementations are robust, properly isolated, and provide reliable mock testing utilities for the broader debug proxy system.