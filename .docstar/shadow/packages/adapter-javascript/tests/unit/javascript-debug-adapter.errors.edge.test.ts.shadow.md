# packages/adapter-javascript/tests/unit/javascript-debug-adapter.errors.edge.test.ts
@source-hash: 87955e1bd4535c0e
@generated: 2026-02-10T00:41:09Z

## Purpose
Unit test file for error handling edge cases in `JavascriptDebugAdapter`. Tests error message translation and user-facing error help methods with various input patterns and case sensitivity.

## Key Test Structure
- **Test setup** (L5-12): Minimal `AdapterDependencies` stub with mocked logger methods
- **Adapter initialization** (L17-21): Fresh adapter instance created before each test with mock cleanup
- **Core test subject**: `JavascriptDebugAdapter` error handling methods

## Test Coverage

### Error Message Translation (L23-70)
- **ENOENT/not found detection** (L23-35): Tests case-insensitive matching of spawn errors and "not found" messages, expects "Node.js runtime not found" translation
- **Permission errors** (L37-46): Tests EACCES and "permission denied" patterns map to permission-related messages
- **TypeScript tooling errors** (L48-56): Tests specific "Cannot find module" errors for 'ts-node'/'tsx' yield install hints
- **Generic module not found** (L58-65): Tests fallback behavior for generic module errors to runtime not found message
- **Passthrough behavior** (L67-70): Ensures unrecognized errors remain unchanged

### Installation Help Methods (L72-83)
- **`getInstallationInstructions()`**: Validates presence of nodejs.org, tsx, ts-node, and tsconfig-paths references
- **`getMissingExecutableError()`**: Checks for Node.js runtime messaging, nodejs.org link, and PATH environment hints

## Dependencies
- **Vitest**: Testing framework with mocking capabilities (`vi.fn()`, `vi.restoreAllMocks()`)
- **JavascriptDebugAdapter**: Main class under test from `../../src/index.js`
- **@debugmcp/shared**: Type imports for `AdapterDependencies` interface

## Testing Patterns
- Case-insensitive error pattern matching across multiple test cases
- Mock isolation with `beforeEach` cleanup (L18-19)
- Array iteration for testing multiple similar inputs (L52-55, L61-64)
- Regex-based assertion patterns using `toMatch()` for flexible string validation