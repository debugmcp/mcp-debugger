# packages/adapter-javascript/tests/unit/javascript-debug-adapter.runtime.edge.test.ts
@source-hash: b1265c8d96a6455d
@generated: 2026-02-10T00:41:19Z

**Purpose**: Unit test file providing edge case coverage for private runtime helper methods in JavascriptDebugAdapter, focusing on TypeScript execution environment determination and Node.js runtime argument configuration.

**Test Structure**: Vitest-based test suite (L22-203) with mocked dependencies and utilities for testing internal adapter behavior.

**Key Test Dependencies**:
- Mocked logger dependencies (L9-16) - stubbed AdapterDependencies for testing
- Utility function `norm()` (L18-20) - normalizes file paths by converting backslashes to forward slashes
- Mock setup/teardown (L25-33) - restores mocks between tests

**Primary Test Groups**:

1. **`determineRuntimeExecutable` Tests (L35-60)**: Tests private method logic for selecting Node.js runtime executable
   - Non-TypeScript projects return 'node' (L36-39)
   - TypeScript with tsx available returns tsx path (L41-45)
   - TypeScript with only ts-node returns 'node' with hooks handled separately (L47-52)
   - TypeScript without runners logs warning and defaults to 'node' (L54-59)

2. **`determineRuntimeArgs` Tests (L62-170)**: Tests private method for building Node.js runtime arguments
   - Non-TypeScript: deduplicates user-provided runtime args (L63-77)
   - TypeScript with tsx override: preserves only user args, no additional hooks (L79-87)
   - TypeScript with ts-node override: preserves user args without duplication (L89-105)
   - TypeScript without override but tsx present: no hooks added (L107-115)
   - TypeScript with ts-node: adds register hooks, ESM loader, and tsconfig-paths when applicable (L117-144)
   - TypeScript with ts-node but no ESM/paths: adds only core ts-node hooks (L146-169)

3. **Miscellaneous Helper Tests (L172-202)**: Tests public adapter interface methods
   - Module metadata methods (L173-179): getAdapterModuleName, getAdapterInstallCommand, getDefaultLaunchConfig
   - Executable resolution methods (L181-185): getDefaultExecutableName, getExecutableSearchPaths
   - Path resolution with override behavior (L187-201): tests preferredPath parameter overriding cached values

**Key Mocking Patterns**:
- `tsdetUtil.detectTsRunners` mocked to control TypeScript runner detection
- `cfg.isESMProject` and `cfg.hasTsConfigPaths` mocked for configuration testing
- Internal adapter methods like `detectTypeScriptRunners` mocked for isolation
- `findNode` utility mocked for executable path resolution testing

**Testing Focus**: Edge cases and error conditions in TypeScript project detection, runtime argument deduplication, and executable resolution logic that would be difficult to test through public API alone.