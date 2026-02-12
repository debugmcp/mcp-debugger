# packages\adapter-javascript\tests/
@generated: 2026-02-12T21:06:06Z

## Purpose
Test suite for the JavaScript debug adapter package, providing comprehensive validation of the adapter's core functionality, configuration handling, environment detection, and integration with the Debug Adapter Protocol (DAP). This directory ensures the adapter works reliably across different JavaScript/TypeScript environments, platforms, and deployment scenarios.

## Key Components and Relationships

### Core Adapter Testing
The test suite validates the complete adapter lifecycle through factory pattern testing and direct adapter functionality:
- **Factory validation**: Environment checks, Node.js version validation, and adapter instantiation
- **Adapter functionality**: DAP protocol integration, configuration transformation, connection management, and lifecycle events
- **Package exports**: Validation of public API surface and proper module exports

### Configuration Intelligence
Tests verify the adapter's ability to intelligently detect and handle different project configurations:
- **Project type detection**: ESM vs CommonJS module detection with fallback strategies
- **TypeScript integration**: Path mapping resolution, output file pattern detection, and tsconfig.json processing
- **Configuration transformation**: Launch config adaptation for different runtime environments

### Environment and Executable Resolution
Cross-platform testing ensures reliable executable discovery and environment handling:
- **Node.js resolution**: PATH-based discovery with platform-specific extensions and fallback logic
- **TypeScript runtime detection**: tsx/ts-node discovery with precedence rules and caching
- **Environment isolation**: Clean test execution with proper setup/teardown of environment variables

### Build and Deployment Utilities
Tests validate helper utilities for build processes and deployment strategies:
- **Asset selection**: GitHub release asset filtering and path normalization
- **Vendoring strategies**: Environment-driven deployment decisions for debug server distribution

## Public API Surface Tested

### Primary Entry Points
- **JavascriptAdapterFactory**: Main factory for adapter creation with environment validation
- **JavascriptDebugAdapter**: Core adapter implementing DAP protocol with configuration transformation
- **Configuration utilities**: Project detection and transformation functions
- **Executable resolvers**: Cross-platform Node.js and TypeScript tooling discovery

### Key Methods Validated
- `validate()`: Environment and dependency validation
- `transformLaunchConfig()`: Configuration adaptation with TypeScript support
- `sendDapRequest()` / `handleDapEvent()`: DAP protocol communication
- Utility functions for project detection, executable resolution, and path handling

## Internal Organization and Data Flow

### Testing Architecture
1. **Mock infrastructure**: Consistent filesystem and environment mocking across all test files
2. **Edge case isolation**: Dedicated test files for error conditions and boundary cases
3. **Cross-platform validation**: Platform-aware testing with proper executable extension handling
4. **Event-driven testing**: Validation of asynchronous adapter lifecycle and DAP events

### Test Flow Patterns
1. **Environment setup** → mock configuration → test execution → cleanup
2. **Configuration detection** → transformation validation → executable resolution
3. **Error injection** → graceful handling verification → user guidance validation
4. **Platform-specific testing** → cross-platform compatibility → fallback mechanism validation

## Important Patterns and Conventions

### Comprehensive Coverage Strategy
- Main functionality in `.test.ts` files
- Edge cases in `.edge.test.ts` files  
- Error conditions in `.throw.edge.test.ts` files
- Consistent MockFileSystem pattern for filesystem operations
- Environment variable isolation with automatic cleanup

### Error Handling Validation
Extensive testing of error scenarios including malformed configurations, missing dependencies, filesystem failures, and network issues, ensuring users receive helpful guidance and the adapter degrades gracefully.

### Cross-Platform Compatibility
Platform-aware testing validates Windows (.exe/.cmd) and Unix executable handling, PATH resolution across different shells, and environment-specific configuration detection.

This test directory ensures the JavaScript debug adapter is reliable, user-friendly, and compatible across diverse development environments while maintaining clean separation between functionality testing, edge case validation, and error condition handling.