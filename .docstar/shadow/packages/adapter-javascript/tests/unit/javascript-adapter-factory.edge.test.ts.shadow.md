# packages/adapter-javascript/tests/unit/javascript-adapter-factory.edge.test.ts
@source-hash: f7888160fc939997
@generated: 2026-02-10T00:41:06Z

## Purpose
Edge case test suite for JavascriptAdapterFactory validation logic, focusing on error handling and path detection scenarios that test specific code branches in the adapter's validation process.

## Core Test Infrastructure

**Helper Functions (L7-12):**
- `norm()`: Normalizes file paths by replacing backslashes with forward slashes
- `isVendorPath()`: Detects vendor debug server paths ending with `/vendor/js-debug/vsDebugServer.js`

**Test Setup (L15-31):**
- Preserves original PATH environment variable and Node.js version descriptor
- Comprehensive mock restoration in beforeEach/afterEach hooks
- Uses Vitest framework with extensive mocking of fs operations

## Test Scenarios

**Error Path Testing (L33-49):**
- Tests fs.existsSync throwing exceptions when checking vendor paths
- Validates graceful error handling with appropriate error messages
- Verifies factory returns invalid state with descriptive error text

**TypeScript Runner Detection (L51-86):**
- Tests complex PATH scanning logic for tsx and ts-node executables
- Validates early termination when both runners found in same directory
- Checks platform-specific executable variants (.cmd, .exe extensions)
- Verifies warning suppression when runners are detected

**Filesystem Error Resilience (L88-112):**
- Tests `existsSafe` error swallowing behavior for corrupted PATH entries
- Validates continued operation when some PATH directories throw fs errors
- Ensures overall validation completes despite partial filesystem failures

## Key Dependencies
- Vitest testing framework with extensive mocking capabilities
- Node.js fs module for filesystem operations
- JavascriptAdapterFactory from main adapter module
- Path manipulation utilities

## Testing Patterns
- Comprehensive environment variable manipulation
- Selective fs.existsSync mocking based on path patterns
- Edge case validation for error handling branches
- Cross-platform executable detection logic