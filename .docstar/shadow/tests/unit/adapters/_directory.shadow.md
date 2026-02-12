# tests/unit/adapters/
@generated: 2026-02-11T23:47:38Z

## Overall Purpose
This directory contains comprehensive unit test suites for the debugMCP adapter system, validating core adapter management, dynamic loading, registry operations, and specific adapter implementations (JavaScript and Mock).

## Key Components and Relationships

**AdapterLoader Testing** (`adapter-loader.test.ts`):
- Tests dynamic module loading with 3-tier fallback system (direct import → node_modules → createRequire)
- Validates adapter discovery, caching, and availability checking
- Covers monorepo development and production deployment scenarios

**AdapterRegistry Testing** (`adapter-registry.test.ts`):
- Tests centralized adapter factory registration and lifecycle management
- Validates adapter creation, disposal, and instance limits per language
- Tests dynamic loading integration and auto-disposal mechanisms

**Specific Adapter Testing**:
- **JavaScript Adapter** (`javascript-debug-adapter.test.ts`): Tests Node.js debugging features, error translation, and DAP launch coordination
- **Mock Adapter** (`mock-debug-adapter.test.ts`): Tests adapter state transitions, feature support, and error scenario injection

**Launch Coordination** (`js-debug-launch-barrier.test.ts`):
- Tests JavaScript-specific launch readiness detection utility
- Validates DAP event synchronization and timeout handling

## Public API Surface
The tests validate these key entry points:
- **AdapterLoader**: `loadAdapter()`, `isAdapterAvailable()`, `listAvailableAdapters()`
- **AdapterRegistry**: `register()`, `createAdapter()`, `disposeAll()`, dynamic loading capabilities
- **Debug Adapters**: `initialize()`, `connect()`, `disconnect()`, `supportsFeature()`, `translateErrorMessage()`
- **Launch Barriers**: Event-driven readiness detection with timeout fallback

## Internal Organization and Data Flow
Tests follow a consistent pattern:
1. **Setup**: Mock dependencies via factory functions (`createDependencies()`, `createMockAdapterFactory()`)
2. **Isolation**: Extensive vitest mocking for external dependencies
3. **State Validation**: Testing state transitions (READY → CONNECTED → DISCONNECTED)
4. **Error Scenarios**: Comprehensive error handling and fallback testing
5. **Cleanup**: Proper disposal and cache clearing between tests

## Important Patterns and Conventions
- **Dependency Injection**: All adapters use mock dependencies for isolation
- **Factory Pattern**: Mock adapter factories for consistent test setup
- **Event-Driven Testing**: DAP event simulation and launch coordination validation
- **Cache Testing**: Verification of loading optimization and cache invalidation
- **Fallback Validation**: Multi-tier loading strategies with graceful degradation
- **Timeout Management**: Fake timers for time-sensitive operations
- **Error Translation**: User-friendly error message transformation testing

The test suite ensures the adapter system's reliability in dynamic loading, lifecycle management, and debugging protocol integration across multiple language targets.