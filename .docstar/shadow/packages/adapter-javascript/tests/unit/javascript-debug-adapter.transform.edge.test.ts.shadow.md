# packages/adapter-javascript/tests/unit/javascript-debug-adapter.transform.edge.test.ts
@source-hash: dbd2f9ddb47d5c78
@generated: 2026-02-09T18:14:05Z

## Purpose
Unit test file for edge cases in JavascriptDebugAdapter's `transformLaunchConfig` method, focusing on runtime executable overrides, argument deduplication, TypeScript detection, and configuration merging behaviors.

## Key Test Structure
- **Test setup** (L25-33): Creates fresh JavascriptDebugAdapter instance with minimal dependencies stub before each test
- **Dependencies stub** (L9-16): Minimal logger implementation for adapter initialization
- **Helper function `norm`** (L18-20): Normalizes file paths by replacing backslashes with forward slashes for cross-platform compatibility

## Core Test Scenarios

### Runtime Executable Override (L35-46)
Tests that custom absolute `runtimeExecutable` paths bypass auto-detection and preserve only user-provided `runtimeArgs`.

### TypeScript Runtime Args Preservation (L48-76)
Validates that when user provides existing ts-node hooks with 'tsx' executable, the adapter preserves user args without duplication. Includes `countPair` helper (L66-72) to verify hook argument uniqueness.

### Argument Deduplication (L78-122)
Complex test ensuring duplicate TypeScript hooks are deduplicated when:
- User provides duplicate args AND adapter would add the same args
- Mocks `tsdet.detectBinary`, `cfg.isESMProject`, and `cfg.hasTsConfigPaths` to force adapter additions
- Uses same `countPair` pattern (L108-114) to verify final uniqueness

### TypeScript .cts File Handling (L124-138)
Tests that `.cts` files in ESM projects get `--loader ts-node/esm` when ts-node is available.

### Source Maps Configuration (L140-150)
Verifies that `sourceMaps: false` without `outFiles` results in omitted `outFiles` property.

### Skip Files Merging (L152-162)
Tests merging and deduplication of `skipFiles` arrays with adapter defaults, ensuring no duplicate entries.

## Dependencies
- **vitest**: Test framework and mocking utilities
- **JavascriptDebugAdapter**: Main class under test from `../../src/index.js`
- **cfg module**: Configuration utilities for ESM/tsconfig detection
- **tsdet module**: TypeScript binary detection utilities
- **@debugmcp/shared**: AdapterDependencies type definition

## Testing Patterns
- Extensive use of vi.spyOn() for mocking external dependencies
- Path normalization with `norm()` for cross-platform assertions
- Custom `countPair` helper for verifying argument deduplication
- Mock restoration in beforeEach/afterEach hooks