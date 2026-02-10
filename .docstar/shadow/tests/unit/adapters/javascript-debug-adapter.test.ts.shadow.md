# tests/unit/adapters/javascript-debug-adapter.test.ts
@source-hash: 7200caa00d2263aa
@generated: 2026-02-10T00:41:30Z

## Purpose
Unit test suite for `JavascriptDebugAdapter` class, focusing on runtime helpers, error handling, feature support, and launch coordination mechanisms.

## Test Structure
- **Main test suite**: `JavascriptDebugAdapter runtime helpers` (L32-86)
- **Mock setup**: Vi.js mocks for config transformers (L8-12) and TypeScript detection (L14-17)
- **Dependency factory**: `createDependencies()` (L19-30) creates mock dependencies with logger, fileSystem, environment, processLauncher, and networkManager

## Key Test Cases

### Runtime Arguments Processing (L38-54)
Tests deduplication of TypeScript runtime hooks:
- Mocks `detectTypeScriptRunners` to return `{ tsNode: 'ts-node' }`
- Verifies `determineRuntimeArgs()` prevents duplicate `ts-node/register` entries
- Ensures transpile-only mode and loader flags are properly added

### Error Translation (L56-60) 
Tests `translateErrorMessage()` method:
- Verifies ENOENT spawn errors are converted to user-friendly "Node.js runtime not found" messages

### Feature Support Matrix (L62-67)
Tests `supportsFeature()` method against `DebugFeature` enum:
- **Supported**: `CONDITIONAL_BREAKPOINTS`, `EVALUATE_FOR_HOVERS` 
- **Unsupported**: `DATA_BREAKPOINTS`

### Launch Coordination (L69-85)
Tests `createLaunchBarrier()` functionality:
- **Launch commands** (L69-80): Returns barrier with `awaitResponse: false`, handles DAP events, provides async `waitUntilReady()`
- **Non-launch commands** (L82-85): Returns `undefined` for commands like 'threads'

## Dependencies
- **Test framework**: Vitest with mocking capabilities
- **Target class**: `JavascriptDebugAdapter` from adapter-javascript package
- **Shared types**: `DebugFeature` enum from @debugmcp/shared
- **Mocked utilities**: config-transformer.js and typescript-detector.js

## Test Patterns
- Uses beforeEach hook (L33-36) for mock cleanup
- Employs type casting with `(adapter as any)` for testing private methods
- Mock functions defined at module level: `mockDetectRunners`, `mockDetectBinary` (L5-6)