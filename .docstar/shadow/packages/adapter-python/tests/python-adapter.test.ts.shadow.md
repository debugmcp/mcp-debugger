# packages/adapter-python/tests/python-adapter.test.ts
@source-hash: a7662bfb5631d779
@generated: 2026-02-10T00:41:20Z

## Primary Purpose
Test file for the `@debugmcp/adapter-python` package that performs smoke tests to verify exported functionality.

## Test Structure
- **Main test suite** (L8-23): `'@debugmcp/adapter-python package'` - validates package exports
- Uses Vitest testing framework with `describe`, `test`, and `expect` imports (L1)

## Key Test Cases

### PythonAdapterFactory Export Test (L9-13)
- Verifies `PythonAdapterFactory` class is properly exported and instantiable
- Creates factory instance to confirm constructor works
- Tests both definition and instantiation

### PythonDebugAdapter Export Test (L15-18)
- Validates `PythonDebugAdapter` class is exported
- **Does not instantiate** - comment notes avoiding instantiation without proper dependencies (L17)
- Smoke test only checks class availability

### findPythonExecutable Export Test (L20-22)
- Confirms `findPythonExecutable` is exported as a function
- Type check only - does not execute the function

## Dependencies
- **Vitest**: Testing framework (`describe`, `test`, `expect`)
- **Local module**: `../src/index.js` - imports all tested exports (L2-6)

## Testing Pattern
Follows minimal smoke test pattern - verifies exports exist and have correct types without testing full functionality or requiring complex setup. Intentionally lightweight to catch basic packaging/export issues.