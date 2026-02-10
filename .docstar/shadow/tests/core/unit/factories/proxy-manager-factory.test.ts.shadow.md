# tests/core/unit/factories/proxy-manager-factory.test.ts
@source-hash: 9f8bfdca4bb28bc3
@generated: 2026-02-10T01:19:02Z

## Purpose
Comprehensive unit tests for ProxyManagerFactory and MockProxyManagerFactory classes, validating factory pattern implementation, dependency injection, and mock testing utilities for the debug proxy system.

## Test Structure

### Test Dependencies (L1-11)
- Uses Vitest framework for testing
- Imports ProxyManagerFactory and MockProxyManagerFactory from factories
- Tests against IProxyManager interface and ProxyManager implementation
- Includes comprehensive mock utilities for external dependencies

### Mock Helper Functions
- `createMockDebugAdapter()` (L18-95): Creates fully-featured IDebugAdapter mock with all lifecycle, state management, DAP protocol, and EventEmitter methods stubbed
- Test setup/teardown (L97-107): Initializes mock dependencies and clears mocks between tests

## ProxyManagerFactory Tests (L109-269)

### Core Factory Behavior
- **Instance Creation** (L110-128): Verifies factory creates ProxyManager instances with correct interface methods
- **Independence** (L130-146): Ensures each factory.create() returns separate instances
- **Statelessness** (L148-167): Confirms factory doesn't retain references to created instances
- **Dependency Integrity** (L169-187): Validates same dependencies are passed to all instances using private property access

### Adapter Support
- **With Adapter** (L189-208): Tests factory.create(adapter) functionality
- **Without Adapter** (L210-222): Tests factory.create() with null adapter
- **Multiple Adapters** (L224-242): Ensures different adapters produce different instances
- **Immutability** (L244-268): Verifies factory dependencies remain unchanged across calls

## MockProxyManagerFactory Tests (L271-438)

### Error Handling
- **Uninitialized State** (L272-276): Throws when createFn not set
- **Basic Functionality** (L278-288): Uses provided createFn to generate instances

### State Tracking Features
- **Manager Tracking** (L290-308): Maintains createdManagers array of all instances
- **Multiple Calls** (L310-323): Handles repeated factory calls correctly
- **Instance Independence** (L325-343): Separate factory instances maintain independent state

### Adapter Tracking
- **Last Adapter Storage** (L345-362): Tracks lastAdapter property across calls
- **Parameter Passing** (L364-380): Passes adapter parameter to createFn
- **Error Resilience** (L382-392): Tracks adapter even when createFn throws
- **State Updates** (L394-413): Updates lastAdapter on each create() call
- **Conditional Logic** (L415-437): Supports createFn implementations that use adapter parameter

## Key Patterns
- Factory pattern implementation with dependency injection
- Mock factory with state tracking for test introspection
- Comprehensive interface validation through method type checking
- Private property access for dependency verification (using `as any` casting)

## Architecture Notes
- ProxyManagerFactory is stateless - no instance tracking
- MockProxyManagerFactory maintains test state for verification
- Both factories support optional IDebugAdapter parameter
- Mock implementations use Vitest's vi.fn() for spy functionality