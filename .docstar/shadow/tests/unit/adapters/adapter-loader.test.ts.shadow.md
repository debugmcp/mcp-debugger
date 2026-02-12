# tests/unit/adapters/adapter-loader.test.ts
@source-hash: 8d7be45d9db96a4e
@generated: 2026-02-11T16:12:54Z

**Purpose**: Comprehensive unit test suite for AdapterLoader class, covering dynamic module loading, caching, fallback mechanisms, and error handling in the debugMCP adapter system.

**Test Structure**:
- Main test suite: `describe('AdapterLoader')` (L26-440)
- Test setup with mock dependencies (L31-50): logger mock, ModuleLoader mock, and cache clearing
- Factory for creating mock adapters: `createMockAdapterFactory()` (L20-24)

**Key Test Groups**:

**loadAdapter Tests** (L52-232):
- Basic loading and caching validation (L53-77): Tests primary import path and cache behavior
- Fallback mechanism testing (L79-104): Validates fallback to node_modules path when primary import fails
- createRequire fallback (L106-125): Tests final fallback using Node's createRequire
- Error scenarios (L127-178): Module not found, factory class missing, general errors
- JavaScript adapter specific tests (L180-231): Mirrors Python tests for JS adapter

**isAdapterAvailable Tests** (L234-274):
- Availability checking (L235-257): Returns boolean based on successful loading
- Cache behavior verification (L259-273): Ensures availability checks are cached

**listAvailableAdapters Tests** (L276-390):
- Known adapter enumeration (L277-338): Tests hardcoded adapter metadata (python, mock, javascript, rust, go)
- Dynamic availability status (L340-353): Tests installed status based on actual availability
- Monorepo fallback edge case (L357-390): Special handling for development environment

**Private Method Tests** (L392-412):
- Package name generation: `getPackageName()` method behavior (L394-397)
- Factory class naming: `getFactoryClassName()` method behavior (L399-404) 
- Fallback path generation: `getFallbackModulePaths()` method behavior (L406-411)

**Caching Tests** (L414-439):
- Multi-language cache isolation: Verifies separate cache entries per adapter type

**Key Dependencies**:
- AdapterLoader from `../../../src/adapters/adapter-loader.js` (L8)
- IAdapterFactory from `@debugmcp/shared` (L9)
- Vitest testing framework with comprehensive mocking (L7, L12)

**Test Patterns**:
- Extensive use of vi.fn() mocks and mock implementations
- Module import mocking via vi.mock() (L15-17)
- Error simulation with custom error codes (ERR_MODULE_NOT_FOUND, MODULE_NOT_FOUND)
- Cache state verification through direct property access
- Fallback path testing with load count tracking

**Critical Behaviors Tested**:
- Dynamic adapter loading with 3-tier fallback system
- Factory class instantiation and caching
- Error handling with helpful user messages
- Module availability checking without side effects
- Adapter metadata enumeration with installation status