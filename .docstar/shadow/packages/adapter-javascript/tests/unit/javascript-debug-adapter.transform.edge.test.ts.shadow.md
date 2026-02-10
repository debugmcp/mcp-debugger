# packages/adapter-javascript/tests/unit/javascript-debug-adapter.transform.edge.test.ts
@source-hash: dbd2f9ddb47d5c78
@generated: 2026-02-10T00:41:09Z

## Purpose

Unit test file covering edge cases for `JavascriptDebugAdapter.transformLaunchConfig` method. Tests specific scenarios around runtime executable overrides, TypeScript hook deduplication, and configuration merging behaviors.

## Key Components

### Test Infrastructure (L8-33)
- **deps stub (L9-16)**: Minimal `AdapterDependencies` mock with logger interface
- **norm helper (L18-20)**: Normalizes file paths by converting backslashes to forward slashes
- **beforeEach/afterEach (L25-33)**: Creates fresh adapter instance and manages Vitest mocks

### Test Cases

#### Runtime Executable Override (L35-46)
Tests that custom `runtimeExecutable` paths bypass auto-detection and preserve only user-specified `runtimeArgs`.

#### TypeScript Hook Preservation (L48-76)
Verifies that when using 'tsx' with existing ts-node hooks, user arguments are preserved without duplication. Uses `countPair` helper (L66-72) to verify single occurrences of flag-value pairs.

#### Deduplication Logic (L78-122)
Complex test mocking `tsdet.detectBinary`, `cfg.isESMProject`, and `cfg.hasTsConfigPaths` to verify that duplicate runtime arguments are properly deduplicated while maintaining necessary hooks for ESM + tsconfig-paths scenarios.

#### CTS File Handling (L124-138)
Tests `.cts` file extension with ESM project configuration, ensuring `--loader ts-node/esm` is included when ts-node is available.

#### SourceMap Configuration (L140-150)
Verifies that `sourceMaps: false` without `outFiles` results in undefined `outFiles` property.

#### SkipFiles Merging (L152-162)
Tests merging and deduplication of `skipFiles` arrays with default values like `<node_internals>/**` and `**/node_modules/**`.

## Dependencies

- **JavascriptDebugAdapter (L4)**: Main class under test from `../../src/index.js`
- **cfg module (L5)**: Config transformer utilities (`isESMProject`, `hasTsConfigPaths`)
- **tsdet module (L6)**: TypeScript detection utilities (`detectBinary`)
- **Vitest (L2)**: Testing framework with mocking capabilities

## Testing Patterns

Uses comprehensive mocking strategy to isolate transformLaunchConfig behavior. Heavy use of `vi.spyOn` for controlling external dependencies and `mockImplementation` for deterministic binary detection results. All tests follow arrange-act-assert pattern with detailed assertions on runtime configuration properties.