# packages/adapter-mock/tests/mock-adapter.test.ts
@source-hash: e492c8699b926c67
@generated: 2026-02-10T00:41:19Z

## Purpose
Test suite for the mock adapter package exports and basic functionality using Vitest framework.

## Test Structure
- **Mock Adapter Package** (L4-18): Main test suite containing three validation tests
- **Export validation tests** (L5-11): Verify that `MockAdapterFactory` and `MockDebugAdapter` are properly exported from the package index
- **Factory functionality test** (L13-17): Validates that `MockAdapterFactory` can instantiate `MockDebugAdapter` instances

## Key Dependencies
- **Vitest**: Testing framework providing `describe`, `test`, and `expect` functions (L1)
- **Package imports**: `MockAdapterFactory` and `MockDebugAdapter` from `../src/index.js` (L2)

## Test Coverage
1. **Export verification**: Ensures both main classes are defined and accessible
2. **Factory pattern validation**: Confirms the factory can create adapter instances with proper type checking
3. **Instance validation**: Verifies created adapters are correct `MockDebugAdapter` instances

## Notable Patterns
- Uses type assertion `{} as any` (L15) for factory method parameter, indicating flexible configuration object acceptance
- Minimal test coverage focusing on basic integration rather than detailed functionality testing