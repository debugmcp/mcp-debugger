# packages/adapter-javascript/tests/unit/javascript-adapter-factory.validate.test.ts
@source-hash: cc3ee9f5e0b4dce6
@generated: 2026-02-09T18:14:02Z

## Purpose
Unit test suite for the `JavascriptAdapterFactory.validate()` method, ensuring proper validation of Node.js version requirements, js-debug vendor file presence, and TypeScript runner availability warnings.

## Key Functions

**norm() (L6-8)**: Path normalization utility that converts backslashes to forward slashes for cross-platform path comparisons.

**isVendorPath() (L10-12)**: Helper function that checks if a given path points to the expected js-debug vendor file location (`/vendor/js-debug/vsDebugServer.js`).

## Test Structure

**Main describe block (L14-128)**: Contains comprehensive validation tests with proper setup/teardown:
- Saves and restores `process.env.PATH` and `process.version` descriptors (L15-32)
- Uses Vitest mocking to control filesystem and environment conditions

## Test Cases

**Valid configuration test (L34-49)**: Verifies that validation passes when Node.js >= 14 and vendor file exists, with warnings array properly initialized.

**Node version validation (L51-69)**: Tests error condition when Node.js version is below required v14, using property descriptor mocking to simulate older Node versions.

**Missing vendor file test (L71-81)**: Validates error reporting when js-debug vendor file is not found via `fs.existsSync` mocking.

**TypeScript runner warning (L83-96)**: Tests warning generation when no TypeScript runners (tsx/ts-node) are available in PATH.

**TypeScript runner detection (L98-127)**: Complex test that verifies proper detection of tsx in PATH across platforms, mocking filesystem existence for various executable extensions (.cmd, .exe on Windows).

## Dependencies
- Vitest testing framework with mocking capabilities
- Node.js built-in `fs` and `path` modules
- `JavascriptAdapterFactory` from the main package

## Patterns
- Extensive use of Vitest spies for `fs.existsSync` to control file system state
- Environment variable manipulation with proper cleanup
- Cross-platform path handling for Windows/Unix compatibility
- Property descriptor manipulation for Node.js version testing