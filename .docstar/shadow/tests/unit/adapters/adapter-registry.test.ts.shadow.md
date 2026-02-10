# tests/unit/adapters/adapter-registry.test.ts
@source-hash: bfbab48ac8849d3d
@generated: 2026-02-10T01:18:54Z

## Primary Purpose
Unit test suite for the AdapterRegistry class, testing adapter registration, validation, creation, lifecycle management, and dynamic loading capabilities.

## Key Test Utilities
- **createAdapterStub() (L5-33)**: Creates a mock adapter with event handling functionality, including `initialize`, `on`, `once`, `emit`, and `dispose` methods
- **createFactory() (L35-44)**: Creates a mock adapter factory with validation, metadata retrieval, and adapter creation capabilities

## Test Structure
The test suite covers core AdapterRegistry functionality:

### Registration & Validation (L58-89)
- Tests factory registration with validation (`register` method)
- Verifies unregistration behavior and duplicate registration prevention
- Validates factory validation error handling (FactoryValidationError)

### Adapter Creation & Lifecycle (L91-118)
- Tests adapter creation via registered factories
- Enforces maximum instance limits per language
- Validates adapter disposal and cleanup

### Dynamic Loading (L120-162)
- Tests dynamic adapter loading when `enableDynamicLoading` is enabled
- Verifies fallback behavior when initial factory lookup fails
- Handles AdapterNotFoundError for missing adapters

### Auto-Disposal (L164-205)
- Tests automatic adapter disposal on state changes
- Validates timeout-based disposal mechanism
- Ensures timer cleanup on state reactivation

### Bulk Operations (L207-232)
- Tests `disposeAll()` method for cleaning up all active adapters
- Verifies factory registry cleanup

## Key Dependencies
- `vitest` testing framework with mocking capabilities
- `AdapterRegistry` from adapter-registry.js (main class under test)
- Error types from @debugmcp/shared: AdapterNotFoundError, DuplicateRegistrationError, FactoryValidationError

## Test Configuration
- Uses environment variable `MCP_CONTAINER` (managed in beforeEach/afterEach hooks L47-56)
- Employs fake timers for auto-disposal testing
- Comprehensive mock setup for adapter and factory behavior

## Notable Patterns
- Extensive use of Vitest mocking for isolation
- Event-driven adapter state management testing
- Timeout-based resource cleanup validation
- Configuration-driven behavior testing (maxInstancesPerLanguage, enableDynamicLoading, autoDispose)