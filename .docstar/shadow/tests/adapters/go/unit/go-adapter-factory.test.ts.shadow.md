# tests\adapters\go\unit\go-adapter-factory.test.ts
@source-hash: e2049138fd925c2a
@generated: 2026-02-12T21:00:35Z

## Purpose
Unit test suite for GoAdapterFactory, validating Go debug adapter factory functionality including adapter creation, metadata retrieval, and environment validation.

## Key Test Structure
- **Main Test Suite** (L53-264): `GoAdapterFactory` - comprehensive testing of the factory class
- **Mock Dependencies Factory** (L19-51): `createMockDependencies()` - creates complete mock AdapterDependencies with stubbed file system, logger, environment, and process launcher
- **Mock Setup** (L9-17): Mocks child_process.spawn for process execution testing

## Test Categories

### Adapter Creation Tests (L66-76)
- **createAdapter test** (L67-70): Verifies factory produces GoDebugAdapter instances
- **language validation** (L72-75): Confirms adapter has correct DebugLanguage.GO

### Metadata Tests (L78-99)  
- **metadata validation** (L79-87): Validates language, displayName, version, description, and file extensions
- **documentation URL** (L89-92): Ensures GitHub documentation link presence
- **icon validation** (L94-98): Confirms SVG icon data URI format

### Environment Validation Tests (L101-263)
- **successful validation** (L102-133): Tests valid Go/Delve setup with version checking and DAP support
- **Go not found** (L135-149): Handles missing Go installation by manipulating PATH
- **version compatibility** (L151-178): Rejects Go versions < 1.18
- **Delve missing** (L180-208): Detects missing Delve debugger
- **DAP support** (L210-241): Validates Debug Adapter Protocol compatibility
- **platform details** (L243-262): Includes system platform/architecture in validation results

## Key Dependencies
- `@debugmcp/adapter-go`: GoAdapterFactory, GoDebugAdapter classes
- `@debugmcp/shared`: AdapterDependencies interface, DebugLanguage enum  
- `vitest`: Test framework with mocking capabilities
- `child_process.spawn`: Mocked for process execution testing
- `fs.promises.access`: File system validation mocking

## Testing Patterns
- Comprehensive mocking of external dependencies (file system, process spawning)
- Event-driven process simulation using EventEmitter
- Environment manipulation for negative test cases
- Async validation with proper cleanup in beforeEach/afterEach hooks (L56-64)

## Validation Logic
Tests simulate Go/Delve version checking by spawning processes and parsing stdout for version strings, with specific handling for DAP capability detection through command exit codes.