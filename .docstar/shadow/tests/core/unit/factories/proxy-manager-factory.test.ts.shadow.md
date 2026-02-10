# tests/core/unit/factories/proxy-manager-factory.test.ts
@source-hash: 527c6b7a20f3a3c2
@generated: 2026-02-09T18:14:18Z

## Purpose
Comprehensive unit test suite for ProxyManagerFactory and MockProxyManagerFactory classes, validating dependency injection, instance creation behavior, and mock factory state tracking.

## Key Test Structures

### Mock Debug Adapter Factory (L18-95)
`createMockDebugAdapter()` - Creates fully mocked IDebugAdapter with all interface methods stubbed using vitest mocks. Implements complete interface including lifecycle, state management, DAP protocol operations, and EventEmitter methods.

### Test Setup (L97-107) 
- `beforeEach` - Initializes mock dependencies (ProxyProcessLauncher, FileSystem, Logger)
- `afterEach` - Clears all vitest mocks

## ProxyManagerFactory Tests (L109-271)

### Core Factory Behavior (L110-128)
Validates factory creates proper ProxyManager instances with correct dependency injection and interface methods.

### Instance Independence (L130-167)
- Multiple `create()` calls return distinct instances
- Factory doesn't retain references to created instances
- No internal state tracking

### Dependency Management (L169-270)
- Factory maintains consistent dependency references across calls
- Supports optional adapter parameter in `create(adapter?)`
- Dependencies remain unmutated between create calls

## MockProxyManagerFactory Tests (L273-440)

### Error Handling (L274-278)
Throws descriptive error when `createFn` not configured.

### Creation Function Integration (L280-325)
- Uses provided `createFn` for instance creation
- Tracks all created managers in `createdManagers` array
- Supports multiple invocations

### State Tracking (L327-439)
- `lastAdapter` property tracks most recent adapter parameter
- Maintains independent state between factory instances
- Tracks adapter even when `createFn` throws
- Supports adapter-aware creation functions

## Dependencies
- **Test Framework**: vitest for mocking and assertions
- **Source Dependencies**: ProxyManagerFactory, MockProxyManagerFactory, ProxyManager interfaces
- **Test Utilities**: Mock creators for external dependencies, MockProxyManager
- **Shared Types**: IDebugAdapter, DebugLanguage from @debugmcp/shared

## Testing Patterns
- Extensive use of vitest mocks for dependency isolation
- Type-safe interface validation using `toBeTypeOf`
- State verification through private property access (`(factory as any).property`)
- Behavioral testing through mock function call verification