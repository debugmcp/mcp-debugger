# tests/unit/adapters/adapter-registry.test.ts
@source-hash: 3618163f91c7fbe5
@generated: 2026-02-09T18:14:43Z

## Purpose
Unit tests for the AdapterRegistry class, verifying adapter lifecycle management, dynamic loading, factory registration, and instance limits. Tests comprehensive error handling, auto-disposal features, and validation workflows.

## Test Structure
- **Test File**: Validates `../../../src/adapters/adapter-registry.js` functionality
- **Dependencies**: Vitest testing framework, shared error types from `@debugmcp/shared`
- **Environment Management**: Preserves/restores `MCP_CONTAINER` environment variable (L58-67)

## Key Test Utilities

### createAdapterStub() (L5-33)
Mock adapter with event handling capabilities:
- Implements initialize, on, once, emit, dispose methods
- Maintains internal event handler map with proper cleanup for `once` listeners
- Returns vi.fn() mocks for async operations

### createFactory() (L35-44) & getFactory() (L46-55)
Factory function generators with configurable overrides:
- Mock validate, getMetadata, createAdapter methods
- Default returns valid validation results and basic metadata
- `createFactory` includes `__adapter` reference for test access

## Core Test Scenarios

### Registration & Validation (L69-100)
- **Basic Registration** (L69-79): Verifies factory registration with validation calls and unregistration
- **Duplicate Prevention** (L81-87): Ensures DuplicateRegistrationError on re-registration
- **Validation Failure** (L89-100): Tests FactoryValidationError when factory validation fails

### Adapter Creation & Limits (L102-129)
- Tests adapter creation with instance limits (`maxInstancesPerLanguage: 1`)
- Validates adapter configuration structure with session, host, port, paths
- Enforces maximum instance constraints and proper disposal cleanup

### Dynamic Loading (L131-173)
- **Successful Dynamic Load** (L131-154): Tests fallback loading when adapter not pre-registered
- **Failed Dynamic Load** (L156-173): Verifies AdapterNotFoundError when dynamic loading fails
- Uses spy on private `loader` property to mock loading behavior

### Auto-Disposal System (L175-216)
- Tests timer-based auto-disposal with fake timers
- Validates state change event handling (`stateChanged` events)
- Ensures timer clearing when adapter reactivates
- Configuration: `autoDispose: true, autoDisposeTimeout: 1000`

### Cleanup Operations (L218-243)
- Tests `disposeAll()` method for complete registry cleanup
- Verifies all active adapters are disposed and count resets to zero
- Ensures factories are cleared from registry

## Test Patterns
- Extensive use of Vitest mocks and spies for isolation
- Timer manipulation with `vi.useFakeTimers()` for async behavior testing
- Private property access via `(registry as any)` for internal testing
- Consistent adapter configuration object structure across tests