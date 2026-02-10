# tests/unit/adapters/adapter-loader.test.ts
@source-hash: 51724e5db77f2dc6
@generated: 2026-02-10T00:41:39Z

## Unit Test Suite for AdapterLoader

**Primary Purpose**: Comprehensive test suite for the `AdapterLoader` class, validating dynamic module loading, caching mechanisms, fallback strategies, and error handling for debug adapter packages.

## Core Test Structure

**Test Setup (L31-50)**:
- Mocks logger and ModuleLoader dependencies
- Clears adapter cache between tests to ensure isolation
- Uses Vitest framework with comprehensive mocking

**Mock Factory Creator (L20-24)**:
- `createMockAdapterFactory()`: Creates standardized mock adapter factories with metadata, adapter creation, and validation methods

## Key Test Categories

### loadAdapter Method Tests (L52-232)

**Success Path (L53-77)**:
- Tests successful adapter loading and caching for Python adapter
- Validates factory instantiation and logging behavior
- Confirms cache hit on subsequent calls

**Fallback Mechanisms (L79-104, L206-231)**:
- Tests fallback to alternative module paths when primary import fails
- Validates node_modules and packages directory fallbacks
- Tests both Python and JavaScript adapters

**createRequire Fallback (L106-125)**:
- Tests final fallback mechanism using Node.js createRequire
- Validates when dynamic imports fail completely

**Error Scenarios**:
- Module not found errors with helpful installation messages (L127-147)
- Missing factory class errors (L149-162)
- General loading errors with proper error propagation (L164-178)

### isAdapterAvailable Method Tests (L234-274)

**Availability Checks**:
- Returns true for loadable adapters (L235-244)
- Returns false for unavailable adapters (L246-257)
- Implements caching for availability results (L259-273)

### listAvailableAdapters Method Tests (L276-354)

**Adapter Metadata (L277-338)**:
- Returns metadata for all known adapters (python, javascript, rust, go, mock, c++)
- Includes package names, descriptions, and installation status
- Tests availability status determination

**Monorepo Fallback (L357-390)**:
- Validates JavaScript adapter detection from monorepo packages structure
- Ensures correct installation status when resolved via fallback paths

### Private Method Testing (L392-412)

**Internal API Validation**:
- Package name generation: `getPackageName()` (L395-397)
- Factory class name generation: `getFactoryClassName()` (L399-404)
- Fallback path generation: `getFallbackModulePaths()` (L406-411)

### Caching Behavior (L414-439)

**Cache Isolation**:
- Validates separate cache entries for different adapter types
- Confirms cache persistence across multiple load operations

## Key Dependencies

- **AdapterLoader, AdapterMetadata** from `../../../src/adapters/adapter-loader.js` (L8)
- **IAdapterFactory** from `@debugmcp/shared` (L9)
- **ModuleLoader** type for dependency injection (L11)
- **Vitest** testing framework with comprehensive mocking (L7)

## Test Patterns

**Mocking Strategy**:
- ModuleLoader.load() mocked to simulate various loading scenarios
- createRequire() mocked for fallback testing
- Logger methods mocked for behavior verification

**Adapter Types Covered**:
- Python (`@debugmcp/adapter-python`)
- JavaScript (`@debugmcp/adapter-javascript`)
- Mock (`@debugmcp/adapter-mock`)
- Additional adapters (rust, go, c++) in metadata tests

**Error Code Handling**:
- Tests specific error codes (ERR_MODULE_NOT_FOUND, MODULE_NOT_FOUND)
- Validates appropriate fallback behavior based on error types