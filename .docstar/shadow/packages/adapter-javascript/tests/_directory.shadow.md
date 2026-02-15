# packages\adapter-javascript\tests/
@children-hash: ad3c749de572c13b
@generated: 2026-02-15T09:01:42Z

## Purpose
Test directory for the JavaScript debug adapter package, providing comprehensive test coverage to ensure the adapter correctly implements the Debug Adapter Protocol (DAP) and handles various JavaScript/TypeScript development environments robustly.

## Key Components and Organization

### Primary Test Structure
The directory contains a **unit** subdirectory that houses all unit tests for the JavaScript debug adapter's core components:

- **Core Adapter Tests**: Validate DAP protocol compliance, adapter lifecycle management, and connection handling
- **Factory and Initialization Tests**: Ensure proper adapter instantiation and environment validation
- **Configuration Management Tests**: Verify project detection (ESM, TypeScript) and configuration parsing
- **Environment Resolution Tests**: Test Node.js executable discovery and TypeScript runtime detection
- **Build System Tests**: Validate GitHub asset selection and vendor deployment strategies

### Testing Architecture
The test suite employs a comprehensive mock-based approach:
- **MockFileSystem** classes enable isolated testing without external filesystem dependencies
- **Environment isolation** patterns prevent test pollution and ensure reproducible results
- **Cross-platform awareness** handles Windows vs POSIX differences in executables and paths
- **Edge case coverage** through dedicated `*.edge.test.ts` and `*.throw.edge.test.ts` files

## Key Testing Focus Areas

1. **DAP Protocol Compliance**: Validates request/response handling and event emission according to the Debug Adapter Protocol specification
2. **Configuration Detection**: Tests automatic detection of ESM projects, TypeScript configurations, and output file resolution
3. **Executable Resolution**: Verifies Node.js binary discovery with proper PATH precedence and fallback mechanisms
4. **Error Handling**: Comprehensive testing of graceful degradation when configurations are malformed or dependencies are missing
5. **Environment Compatibility**: Ensures the adapter works across different development environments and platforms

## Public API Coverage
The tests validate the public interfaces exposed by the JavaScript debug adapter:
- **JavascriptDebugAdapter** class and its DAP implementation
- **Factory patterns** for adapter instantiation and environment validation
- **Configuration transformation** utilities for project setup detection
- **Executable resolution** APIs for Node.js and TypeScript runtime discovery

## Testing Strategy
- **Unit-focused**: All tests are isolated unit tests using mocks rather than integration tests
- **Edge case driven**: Dedicated edge case files ensure robust error handling and boundary condition coverage
- **Platform-agnostic**: Tests account for cross-platform differences while validating consistent behavior
- **Fault-tolerant**: Extensive testing of error scenarios ensures the adapter degrades gracefully when encountering issues

This test directory ensures the JavaScript debug adapter is production-ready, handles real-world development environments reliably, and maintains strict compliance with the Debug Adapter Protocol specification across diverse JavaScript and TypeScript project configurations.