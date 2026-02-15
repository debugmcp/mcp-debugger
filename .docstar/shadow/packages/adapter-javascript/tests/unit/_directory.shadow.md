# packages\adapter-javascript\tests\unit/
@children-hash: d7eb7fa10c7dffa8
@generated: 2026-02-15T09:01:29Z

## Purpose
Unit test directory for the JavaScript debug adapter package, providing comprehensive test coverage for the adapter's core functionality, configuration management, executable resolution, and build system components.

## Key Components and Organization

### Core Adapter Testing
- **JavascriptDebugAdapter** core functionality tests:
  - `javascript-debug-adapter.*.test.ts` files cover adapter lifecycle, DAP protocol integration, connection management, configuration transformation, and error handling
  - Edge case files (`*.edge.test.ts`, `*.throw.edge.test.ts`) provide additional branch coverage for error scenarios and boundary conditions

### Factory and Initialization
- **factory-export.test.ts**: Tests adapter factory pattern and initialization lifecycle
- **javascript-adapter-factory.*.test.ts**: Validates environment validation, Node.js version checking, and TypeScript runner detection

### Configuration and Environment
- **config-transformer.*.test.ts**: Tests project configuration detection (ESM, TypeScript paths, output files) with comprehensive edge case coverage for malformed JSON handling
- **executable-resolver.*.test.ts**: Tests cross-platform Node.js executable discovery with PATH resolution and fallback mechanisms
- **typescript-detector.*.test.ts**: Tests TypeScript runtime tool detection (tsx, ts-node) with caching and platform-specific binary resolution

### Build System Testing
- **build-js-debug.helpers.test.ts**: Tests build helper utilities for GitHub asset selection and path normalization
- **vendor-strategy.test.ts**: Tests vendoring strategy determination based on environment variables

## Testing Architecture

### Mock Infrastructure
- Extensive use of MockFileSystem classes implementing the FileSystem interface for isolated testing
- Environment variable manipulation with cleanup patterns
- Cross-platform executable handling (Windows .cmd/.exe vs Unix executables)

### Test Patterns
- **Fault tolerance**: Edge case files validate graceful error handling when filesystem operations fail
- **Platform awareness**: Tests account for Windows vs POSIX differences in executable names and paths
- **Environment isolation**: Tests preserve and restore process environment to prevent pollution
- **Caching validation**: Tests verify caching behavior and cache invalidation mechanisms

## Key Testing Focus Areas

1. **Debug Adapter Protocol (DAP) Compliance**: Validates proper request/response handling and event emission
2. **Configuration Detection**: Tests ESM project detection, TypeScript configuration parsing, and output file determination
3. **Executable Resolution**: Tests Node.js binary discovery with PATH precedence and fallback logic
4. **Error Recovery**: Comprehensive edge case testing for filesystem errors, malformed configurations, and missing dependencies
5. **Build System**: Tests GitHub release asset selection and vendor deployment strategies

## Test Coverage Strategy
- Main test files cover primary functionality and happy paths
- Edge case files (`*.edge.test.ts`) provide additional branch coverage for less common scenarios
- Throw edge files (`*.throw.edge.test.ts`) specifically test error handling and exception recovery
- Mock-based testing enables isolated unit testing without external dependencies

## Dependencies
- **Vitest**: Primary testing framework with extensive mocking capabilities
- **@debugmcp/shared**: Core adapter interfaces and utilities
- **@vscode/debugprotocol**: DAP type definitions for protocol compliance testing
- Platform-specific utilities for cross-platform executable resolution testing

The test suite ensures the JavaScript debug adapter is robust, handles edge cases gracefully, and maintains compatibility across different development environments and platforms.