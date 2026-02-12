# tests\unit\adapters/
@generated: 2026-02-12T21:00:53Z

## Purpose
Unit testing module for the debugMCP adapter system, providing comprehensive test coverage for adapter loading, registration, lifecycle management, and adapter-specific implementations.

## Key Components

### Core Adapter Infrastructure Tests
- **AdapterLoader Tests** (`adapter-loader.test.ts`): Validates dynamic module loading with 3-tier fallback system, caching mechanisms, and adapter availability checking
- **AdapterRegistry Tests** (`adapter-registry.test.ts`): Tests adapter registration, validation, creation, lifecycle management, and dynamic loading coordination

### Language-Specific Adapter Tests
- **JavascriptDebugAdapter Tests** (`javascript-debug-adapter.test.ts`): Validates JavaScript debugging features, error translation, and launch coordination
- **MockDebugAdapter Tests** (`mock-debug-adapter.test.ts`): Tests mock adapter behaviors, state transitions, feature support, and error scenario injection

### Specialized Utility Tests
- **JsDebugLaunchBarrier Tests** (`js-debug-launch-barrier.test.ts`): Tests launch readiness detection and DAP event synchronization for JavaScript debugging

## Component Relationships

The test suite follows a layered architecture mirroring the production system:

1. **Foundation Layer**: AdapterLoader handles dynamic module discovery and loading
2. **Registry Layer**: AdapterRegistry manages adapter factories and instance lifecycle
3. **Implementation Layer**: Language-specific adapters (JavaScript, Mock) provide debugging capabilities
4. **Utility Layer**: Specialized utilities like JsDebugLaunchBarrier handle adapter-specific coordination

## Testing Patterns & API Surface

### Mock Infrastructure
- **Adapter Factories**: `createMockAdapterFactory()`, `createFactory()` for registry testing
- **Dependencies**: `createDependencies()` providing mock logger, filesystem, and network services
- **Adapters**: `createAdapterStub()` with event handling and lifecycle methods

### Key Test Categories
- **Dynamic Loading**: Tests 3-tier fallback system (direct import → node_modules → createRequire)
- **Lifecycle Management**: Validates adapter state transitions (READY → CONNECTED → DISCONNECTED)
- **Feature Support**: Tests adapter capability reporting and feature validation
- **Error Handling**: Validates error translation, scenario injection, and failure recovery
- **Caching**: Ensures proper cache isolation and invalidation across adapter types

### Testing Framework Integration
- **Vitest-based**: Comprehensive mocking with `vi.mock()`, `vi.fn()`, and fake timers
- **Async Testing**: Promise-based assertions for adapter lifecycle and event coordination
- **State Validation**: Direct property access and spy verification for internal state

## Internal Organization

Tests are organized by component responsibility:
- Infrastructure components test system-level concerns (loading, registration)
- Adapter implementations test debugging-specific functionality
- Utilities test specialized coordination mechanisms

The test suite validates both the public API contracts and internal implementation details necessary for reliable adapter system operation, ensuring robust dynamic loading, proper resource management, and consistent debugging capabilities across different language runtimes.