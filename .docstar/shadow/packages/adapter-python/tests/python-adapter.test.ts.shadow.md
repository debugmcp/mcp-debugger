# packages/adapter-python/tests/python-adapter.test.ts
@source-hash: a7662bfb5631d779
@generated: 2026-02-09T18:14:29Z

**Primary Purpose:** Test file for the `@debugmcp/adapter-python` package that validates the public API exports through smoke tests using Vitest framework.

**Key Test Structure:**
- Main test suite: `@debugmcp/adapter-python package` (L8-23)
- Three smoke tests validating core exports without full instantiation

**Test Cases:**
1. **PythonAdapterFactory test** (L9-13): Verifies factory class is exported and can be instantiated
2. **PythonDebugAdapter test** (L15-18): Confirms debug adapter class export (no instantiation due to dependency requirements)
3. **findPythonExecutable test** (L20-22): Validates utility function export and type

**Dependencies:**
- Vitest testing framework (L1)
- Package exports from `../src/index.js` (L2-6)

**Testing Strategy:**
- Smoke testing approach - validates exports exist and have correct types
- Intentionally avoids complex instantiation that would require mocking dependencies
- Comment on L17 explains deliberate decision to skip PythonDebugAdapter instantiation

**Architectural Notes:**
- Tests the public API surface of the Python debug adapter package
- Follows standard Node.js package testing patterns with relative imports
- Uses factory pattern for adapter creation