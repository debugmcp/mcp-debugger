# packages\adapter-javascript\tests\unit/
@generated: 2026-02-12T21:01:03Z

## Directory Purpose

The `packages/adapter-javascript/tests/unit` directory contains comprehensive unit tests for the JavaScript debug adapter package. It validates all core functionality of the adapter system including configuration management, executable resolution, build tooling, DAP protocol handling, lifecycle management, and TypeScript support detection.

## Test Architecture

### Core Test Categories

**Adapter Lifecycle & Protocol Tests**
- `javascript-debug-adapter.*.test.ts` files test the main `JavascriptDebugAdapter` class covering initialization, connection management, DAP protocol compliance, configuration transformation, and error handling
- Validates state transitions (UNINITIALIZED → INITIALIZING → READY → CONNECTED/DEBUGGING)
- Tests event emission patterns for adapter lifecycle events

**Configuration & Environment Tests**
- `config-transformer.*.test.ts` files test project analysis utilities that detect ESM projects, TypeScript path mappings, and output file patterns
- Tests fault tolerance for malformed JSON in package.json/tsconfig.json files
- Edge cases include empty paths, missing files, and filesystem operation failures

**Executable Resolution Tests**
- `executable-resolver.*.test.ts` files test cross-platform Node.js executable discovery in PATH and preferred locations
- `typescript-detector.*.test.ts` files test TypeScript runtime tool detection (tsx, ts-node) with caching
- Platform-aware testing for Windows (.exe, .cmd) vs POSIX executable handling

**Build System Tests**
- `build-js-debug.helpers.test.ts` tests GitHub release asset selection and path normalization utilities
- `vendor-strategy.test.ts` validates environment-driven vendoring strategies (local/prebuilt/source)

**Factory & Integration Tests**
- `javascript-adapter-factory.*.test.ts` files test adapter creation, validation logic, and environment checking
- `factory-export.test.ts` validates package exports and adapter instantiation

## Key Testing Patterns

### Mock Infrastructure
- **MockFileSystem**: Configurable filesystem simulation for testing file operations without real I/O
- **Environment isolation**: PATH and NODE_OPTIONS manipulation with cleanup
- **Dependency injection**: FileSystem and other dependencies injected for controlled testing

### Cross-Platform Testing
- Platform-aware expectations using `isWindows()` detection
- Path normalization utilities for Windows/POSIX compatibility
- Executable suffix handling (.cmd, .exe on Windows)

### Error Handling & Edge Cases
- Comprehensive fault tolerance testing for filesystem failures
- Malformed configuration file handling
- Environment variable parsing edge cases
- Network/GitHub API failure simulation

### Caching & Performance
- Cache behavior validation for executable detection
- Idempotency testing for repeated operations
- Memory leak prevention through proper mock cleanup

## Key Components Tested

**JavascriptDebugAdapter** - Main adapter class with:
- DAP protocol request/response handling
- Configuration transformation for JS/TS projects
- Connection state management
- Error message translation for user-friendly output

**Configuration Analysis** - Project detection utilities:
- `isESMProject()` - ES module project detection via package.json/tsconfig
- `hasTsConfigPaths()` - TypeScript path mapping detection
- `determineOutFiles()` - Output file pattern determination

**Executable Resolution** - Binary discovery system:
- `findNode()` - Node.js executable location with fallbacks
- `detectBinary()` - TypeScript tool detection with PATH precedence
- Cross-platform executable name handling

**Build Utilities** - Development tooling support:
- GitHub release asset selection with priority ordering
- Vendor strategy determination from environment variables
- Path normalization for cross-platform builds

## API Surface

### Test Entry Points
All test files use standard Vitest patterns with `describe()` and `it()` blocks. Key test utilities include:

- **Mock factories**: For creating test doubles of filesystem, logger, and adapter dependencies
- **Environment helpers**: `withPath()` for temporary PATH manipulation
- **Platform utilities**: Cross-platform path and executable handling
- **Event testing**: Patterns for testing event-driven adapter behavior

### Test Coverage Goals
- **Functionality**: All public methods and configuration paths
- **Error handling**: Exception safety and graceful degradation
- **Cross-platform**: Windows and POSIX system compatibility
- **Edge cases**: Malformed input, missing files, network failures
- **Performance**: Caching behavior and resource cleanup

The test suite ensures the JavaScript debug adapter is robust, cross-platform compatible, and handles real-world deployment scenarios including TypeScript projects, various Node.js configurations, and development environment variations.