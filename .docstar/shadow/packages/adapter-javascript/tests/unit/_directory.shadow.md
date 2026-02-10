# packages/adapter-javascript/tests/unit/
@generated: 2026-02-10T01:19:42Z

## Purpose
Unit test suite for the JavaScript debug adapter package, providing comprehensive coverage of adapter functionality, configuration handling, executable resolution, and debug protocol integration. Tests validate the core debugging capabilities and ensure reliable operation across different platforms and environments.

## Key Components

### Core Adapter Testing
- **Factory Pattern Tests**: `factory-export.test.ts` validates JavascriptAdapterFactory creation and adapter instantiation lifecycle
- **Lifecycle Management**: `javascript-adapter-factory.validate.test.ts` and `javascript-debug-adapter.lifecycle.*.test.ts` test initialization, validation, state transitions, and disposal
- **Capabilities**: `javascript-debug-adapter.capabilities.test.ts` validates debug feature support, DAP capabilities, and error handling

### Configuration & Environment
- **Config Transformation**: `config-transformer.*.test.ts` files test project detection (ESM vs CommonJS), TypeScript path handling, and output file determination
- **Launch Configuration**: `javascript-debug-adapter.transform.*.test.ts` test debug launch config transformation, runtime args handling, and environment setup
- **Vendor Strategy**: `vendor-strategy.test.ts` validates debug server deployment strategies and environment variable parsing

### Executable Resolution
- **Runtime Discovery**: `executable-resolver.*.test.ts` test cross-platform Node.js executable detection, PATH precedence, and fallback mechanisms
- **TypeScript Tools**: `typescript-detector.*.test.ts` validate tsx/ts-node binary discovery with caching and platform-specific suffixes

### Debug Protocol Integration
- **DAP Communication**: `javascript-debug-adapter.dap.test.ts` tests Debug Adapter Protocol request handling and event processing
- **Command Building**: `javascript-debug-adapter.command.*.test.ts` validate adapter command construction and NODE_OPTIONS handling
- **Connection Management**: `javascript-debug-adapter.connection.test.ts` tests connection state management and event emission

### Build System Support
- **Debug Helpers**: `build-js-debug.helpers.test.ts` tests utilities for GitHub release asset selection and path normalization

## Test Architecture Patterns

### Mock Infrastructure
- **MockFileSystem**: Consistent filesystem abstraction across tests for controlling file existence and content
- **Mock Dependencies**: Standardized AdapterDependencies stubs with logger interfaces
- **Environment Isolation**: PATH and environment variable management with cleanup

### Edge Case Coverage
Multiple `*.edge.test.ts` files provide comprehensive coverage of:
- Error handling and fault tolerance
- Platform-specific behaviors (Windows vs POSIX)
- Filesystem operation failures
- Malformed configuration files
- Missing executables and dependencies

### Cross-Platform Testing
- Windows/POSIX executable naming conventions (.exe, .cmd suffixes)
- Path normalization and separator handling
- Platform-specific fallback behaviors

## Public API Testing Surface

### Primary Entry Points
- **JavascriptAdapterFactory.create()**: Adapter instantiation with dependency injection
- **JavascriptDebugAdapter.initialize()**: Async initialization with environment validation
- **Adapter.transformLaunchConfig()**: Debug configuration transformation
- **Adapter.buildAdapterCommand()**: Command line construction for debug server

### Core Capabilities
- **Debug Features**: Breakpoints, evaluation, stepping, exception handling
- **TypeScript Support**: Runtime detection, ESM/CommonJS handling, path mapping
- **Environment Detection**: Project type analysis, executable resolution
- **Error Translation**: User-friendly error messages and installation guidance

## Test Organization
Tests are organized by functional area with comprehensive edge case coverage. Each test file focuses on specific components while maintaining consistency in mocking patterns and setup/teardown procedures. The suite ensures robust operation across different development environments and provides confidence in the adapter's reliability for JavaScript/TypeScript debugging scenarios.