# tests/unit/adapters/adapter-loader.test.ts
@source-hash: 51724e5db77f2dc6
@generated: 2026-02-09T18:14:45Z

## Primary Purpose
Comprehensive unit test suite for AdapterLoader functionality, covering dynamic loading, caching, fallback mechanisms, and error handling for the adapter loading system.

## Test Structure
- **Main Test Suite** (L26-440): Full coverage of AdapterLoader class methods and behaviors
- **Mock Setup** (L20-24, L31-45): Creates mock adapter factories with standard interface methods
- **Test Environment** (L47-50): Proper cleanup between test runs

## Key Test Categories

### loadAdapter Tests (L52-232)
- **Basic Loading & Caching** (L53-77): Verifies successful adapter loading from primary package path and cache behavior
- **Fallback Path Testing** (L79-104): Tests fallback to node_modules when primary import fails
- **createRequire Fallback** (L106-125): Validates final fallback mechanism using Node.js require system
- **Error Scenarios** (L127-178): Covers module not found, missing factory class, and general loading errors
- **JavaScript Adapter Tests** (L180-231): Specific test cases for JavaScript adapter loading patterns

### isAdapterAvailable Tests (L234-274)
- **Availability Detection** (L235-257): Tests true/false returns based on adapter loadability
- **Caching Behavior** (L259-273): Verifies availability checks are cached to avoid redundant loading

### listAvailableAdapters Tests (L276-390)
- **Metadata Listing** (L277-338): Returns comprehensive adapter metadata with installation status
- **Dynamic Status Updates** (L340-353): Tests installed flag updates based on actual availability
- **Monorepo Fallback** (L357-390): Special handling for monorepo development environment

### Internal Method Tests (L392-412)
- **Package Name Generation** (L393-397): Validates @debugmcp/adapter-{name} pattern
- **Factory Class Names** (L399-404): Tests PascalCase factory class name generation
- **Fallback Path Construction** (L406-411): Verifies node_modules and packages fallback paths

### Caching Integration Tests (L414-439)
- **Multi-Language Cache** (L415-438): Ensures separate cache entries for different adapter types

## Key Dependencies
- **vitest**: Testing framework with mocking capabilities
- **AdapterLoader, AdapterMetadata** (L8): Core classes under test
- **IAdapterFactory** (L9): Shared interface from @debugmcp/shared
- **ModuleLoader** (L11): Module loading abstraction

## Test Patterns
- **Mock Module System** (L15-17): Mocks Node.js module system for controlled testing
- **Factory Pattern Testing**: Validates adapter factory instantiation and method calls
- **Error Simulation**: Tests various failure scenarios with appropriate error codes
- **Cache Validation**: Ensures proper caching behavior across multiple adapter types

## Critical Test Behaviors
- Tests cover all three loading strategies: direct import, fallback paths, and createRequire
- Validates proper error messages with installation instructions for missing adapters
- Ensures cache isolation between different adapter languages
- Verifies monorepo development environment support through package path fallbacks