# packages/adapter-javascript/tests/unit/typescript-detector.throw.edge.test.ts
@source-hash: 7e071c34d72cc105
@generated: 2026-02-10T00:41:09Z

## Purpose
Edge case and error handling test suite for `typescript-detector.js` binary detection functionality. Validates error recovery mechanisms when filesystem operations fail during binary detection in local `node_modules` and PATH environments.

## Key Components

### MockFileSystem Class (L10-35)
Implements `FileSystem` interface for controlled testing scenarios:
- `setExistsMock(mock)` (L14): Configures custom existence check behavior
- `setReadFileMock(mock)` (L18): Configures custom file reading behavior  
- `existsSync(path)` (L22): Returns mock result or false default
- `readFileSync(path, encoding)` (L29): Returns mock result or empty string default

### Test Utilities
- `withPath(paths)` (L39-45): Temporarily modifies process.env.PATH, returns restoration function
- `WIN` constant (L37): Platform detection for Windows-specific binary suffixes
- `restoreEnv` (L48): Cleanup function reference for PATH restoration
- `mockFileSystem` (L49): Test instance with configurable behavior

## Test Scenarios

### "local bin check throws, falls back to PATH" (L69-102)
Tests error recovery when local `node_modules/.bin` filesystem access fails:
- Simulates filesystem error on first local candidate check (L86)
- Validates fallback to PATH-based detection succeeds
- Platform-aware expectations: `.cmd` suffix on Windows, bare executable on POSIX

### "no PATH and local throws" (L104-114)  
Tests complete failure scenario:
- Empty PATH environment (L106)
- All filesystem operations throw errors (L108-110)
- Expects `undefined` return when no recovery possible

## Dependencies
- `detectBinary, setDefaultFileSystem` from `typescript-detector.js` (L4)
- `isWindows` from `executable-resolver.js` (L5)
- `FileSystem, NodeFileSystem` from `@debugmcp/shared` (L3)

## Test Strategy
Focuses on error boundary testing and graceful degradation when filesystem operations fail during binary detection. Ensures robust fallback mechanisms work correctly across platforms.