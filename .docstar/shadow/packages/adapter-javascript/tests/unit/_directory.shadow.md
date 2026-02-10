# packages/adapter-javascript/tests/unit/
@generated: 2026-02-09T18:16:17Z

## Purpose and Responsibility

This directory contains comprehensive unit test suites for the JavaScript Debug Adapter package, providing extensive coverage of core functionality, edge cases, and error handling scenarios. The tests validate the adapter's ability to debug Node.js and TypeScript applications through the Debug Adapter Protocol (DAP), with particular focus on environment detection, configuration transformation, executable resolution, and lifecycle management.

## Key Test Modules and Coverage

### Core Adapter Functionality
- **javascript-debug-adapter.test.ts family**: Tests the main `JavascriptDebugAdapter` class across multiple dimensions:
  - **Lifecycle**: Initialization, state transitions (UNINITIALIZED → INITIALIZING → READY), disposal, and error handling
  - **DAP Protocol**: Message handling, event processing, request validation, and protocol compliance
  - **Capabilities**: Feature support reporting, exception filters, installation instructions
  - **Configuration**: Launch config transformation, environment variable handling, TypeScript tooling integration
  - **Connection Management**: Connect/disconnect lifecycle, state synchronization, event emission
  - **Command Building**: Executable path resolution, argument construction, NODE_OPTIONS handling

### Utility Module Testing
- **config-transformer.test.ts family**: Configuration detection and transformation utilities
  - ESM vs CommonJS project detection via package.json and tsconfig.json analysis
  - TypeScript path mapping detection and outFiles determination
  - Malformed JSON resilience and error handling
- **executable-resolver.test.ts family**: Cross-platform executable discovery
  - Node.js runtime path resolution with PATH precedence
  - Windows/POSIX executable suffix handling (.exe, .cmd variants)
  - Fallback mechanisms and error resilience
- **typescript-detector.test.ts family**: TypeScript tooling detection
  - tsx and ts-node runner discovery in local node_modules and system PATH
  - Platform-specific binary resolution with caching behavior
- **vendor-strategy.test.ts**: Build-time dependency vendoring strategy selection
- **build-js-debug.helpers.test.ts**: Asset selection and path normalization utilities

### Integration and Factory Testing
- **javascript-adapter-factory.test.ts family**: Factory class validation and environment checking
  - Node.js version requirements (>= v14)
  - js-debug vendor file presence validation
  - TypeScript runner availability warnings
  - Error handling for missing dependencies
- **factory-export.test.ts**: Package exports and interface compliance validation

## Test Architecture and Patterns

### Mock-Based Isolation
All tests use extensive mocking via Vitest framework to isolate units under test:
- **FileSystem abstraction**: MockFileSystem implementations for controlled file operations
- **Process environment**: Temporary PATH manipulation with proper cleanup
- **External dependencies**: Module mocking for config transformers, executable resolvers

### Cross-Platform Testing
Tests ensure Windows/POSIX compatibility through:
- Platform-aware path normalization helpers (`norm()` functions)
- Conditional test logic based on `isWindows()` detection
- Executable suffix handling (.cmd, .exe on Windows)

### Edge Case and Error Coverage
Dedicated edge test files focus on:
- Malformed configuration file handling
- Filesystem operation failures and exception resilience
- Environment variable edge cases and type coercion
- Cache invalidation and cleanup scenarios

### Test Organization Hierarchy
- **Primary test files**: Core functionality with happy path scenarios
- **Edge test files** (`.edge.test.ts`): Boundary conditions and unusual inputs
- **Throw edge files** (`.throw.edge.test.ts`): Exception handling and error resilience
- **Comprehensive suites**: Multi-faceted testing of complex classes like JavascriptDebugAdapter

## Key Testing Invariants

### Environment Isolation
- All tests preserve and restore `process.env.PATH`, `process.env.NODE_OPTIONS`
- Mock filesystem operations to prevent side effects
- Proper cleanup in beforeEach/afterEach hooks

### State Management Validation
- Adapter state transitions are thoroughly tested (UNINITIALIZED → READY → CONNECTED → DEBUGGING)
- Event emission sequences are validated for lifecycle operations
- Cache invalidation and cleanup behavior is verified

### Configuration Transformation Testing
- TypeScript project detection across various configuration patterns
- Runtime argument deduplication and hook injection
- Environment variable merging without mutation of process.env

## Public API Validation

The test suite validates the complete public interface of:
- `JavascriptDebugAdapter`: Main adapter class with full DAP compliance
- `JavascriptAdapterFactory`: Factory with environment validation and adapter creation
- Utility modules: Configuration detection, executable resolution, TypeScript tooling discovery

These tests ensure the adapter can reliably debug JavaScript and TypeScript applications across platforms while maintaining robust error handling and configuration flexibility.