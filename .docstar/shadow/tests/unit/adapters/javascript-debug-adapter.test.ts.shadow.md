# tests/unit/adapters/javascript-debug-adapter.test.ts
@source-hash: 378b7da8694d749d
@generated: 2026-02-10T21:25:29Z

## Purpose
Unit test suite for JavascriptDebugAdapter class, validating error translation, feature support, and launch coordination mechanisms.

## Test Structure

### Dependencies Factory (L5-16)
`createDependencies()` - Mock factory providing required adapter dependencies:
- Mock logger with vitest spies for all log levels
- Empty objects for fileSystem, environment 
- Type-cast unknowns for processLauncher and networkManager

### Test Cases

**Error Translation Test (L19-23)**
- Validates `translateErrorMessage()` converts ENOENT spawn errors into user-friendly guidance
- Expects "Node.js runtime not found" message for missing Node.js executable

**Feature Support Test (L25-30)**
- Tests `supportsFeature()` method with DebugFeature enum values
- Confirms support for CONDITIONAL_BREAKPOINTS and EVALUATE_FOR_HOVERS
- Verifies DATA_BREAKPOINTS is unsupported (returns false)

**Launch Barrier Test (L32-43)**
- Tests `createLaunchBarrier()` for "launch" command coordination
- Validates barrier properties: defined, awaitResponse=false
- Tests lifecycle: onRequestSent → onDapEvent('stopped') → waitUntilReady resolution
- Includes proper cleanup with dispose()

**Negative Launch Barrier Test (L45-48)**
- Confirms `createLaunchBarrier()` returns undefined for non-launch commands ("threads")

## Key Dependencies
- JavascriptDebugAdapter from adapter-javascript package
- DebugFeature enum from @debugmcp/shared
- Vitest testing framework

## Architectural Notes
- Uses dependency injection pattern with mock objects
- Tests focus on public interface behavior rather than implementation details
- Launch barrier implements async coordination pattern for DAP event synchronization