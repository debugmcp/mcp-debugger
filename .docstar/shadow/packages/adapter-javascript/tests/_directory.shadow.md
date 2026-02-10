# packages/adapter-javascript/tests/
@generated: 2026-02-10T21:26:46Z

## Overall Purpose and Responsibility

This directory contains the comprehensive test suite for the `adapter-javascript` package, validating a JavaScript/TypeScript debug adapter implementation that integrates with the Debug Adapter Protocol (DAP). The tests ensure reliable debugging capabilities for Node.js applications across diverse development environments, with support for multiple runtime configurations and cross-platform compatibility.

## Key Components and Architecture

The test suite is organized into a single **unit** test subdirectory that provides comprehensive coverage for:

### Core Debug Adapter Components
- **JavascriptDebugAdapter**: Primary adapter class with DAP integration, lifecycle management, and error handling
- **JavascriptAdapterFactory**: Factory pattern implementation with environment validation and adapter instantiation
- **Configuration System**: Project analysis utilities for ESM detection, TypeScript support, and build configuration

### Runtime Detection and Resolution
- **TypeScript Detector**: Discovery and validation of ts-node/tsx runtime tools with PATH resolution
- **Executable Resolver**: Cross-platform Node.js binary location with fallback mechanisms
- **Build Infrastructure**: Vendor strategy and asset management for debug server deployment

## Test Organization and Coverage Strategy

### Multi-Layered Testing Approach
- **Base Tests** (`*.test.ts`): Core functionality and happy path scenarios
- **Edge Case Tests** (`*.edge.test.ts`): Boundary conditions, error recovery, and complex configurations  
- **Exception Tests** (`*.throw.edge.test.ts`): Fault tolerance when dependencies fail

### Key Test Categories
- **Protocol Integration**: DAP request/response handling and event processing
- **Configuration Transformation**: Launch config analysis and TypeScript integration
- **Platform Compatibility**: Cross-platform executable resolution and path handling
- **Environment Validation**: Node.js version checking and dependency verification

## Public API Surface and Entry Points

### Primary Interfaces
- **JavascriptAdapterFactory**: Main entry point for adapter creation with comprehensive validation
- **JavascriptDebugAdapter**: Core IDebugAdapter implementation managing debug sessions
- **Configuration Utilities**: ESM detection, TypeScript analysis, and output file determination

### Supported Capabilities
- **Multi-Runtime Support**: Node.js, tsx, ts-node with automatic detection
- **Cross-Platform Operation**: Windows and POSIX executable resolution
- **Intelligent Configuration**: Project type detection with TypeScript integration
- **Graceful Error Handling**: User-friendly error messages with installation guidance

## Internal Data Flow and Integration

### Initialization and Configuration Pipeline
1. **Environment Assessment**: Node.js version validation, vendor file verification, TypeScript tooling detection
2. **Project Analysis**: Package.json and tsconfig.json parsing for project characteristics
3. **Runtime Selection**: Automatic choice between Node.js variants based on file types and tool availability
4. **Debug Session Setup**: DAP communication configuration and launch parameter assembly

### Error Handling and Resilience
The test suite validates a robust error handling strategy featuring:
- **Graceful Degradation**: Default value fallbacks when filesystem operations fail
- **Installation Guidance**: Automated generation of dependency installation instructions
- **Platform Adaptation**: Environment-specific behavior with consistent cross-platform APIs

## Important Testing Patterns and Conventions

### Mock Infrastructure and Isolation
- **FileSystem Abstraction**: Dependency injection enabling comprehensive filesystem operation mocking
- **Environment Manipulation**: Safe PATH and NODE_OPTIONS modification with automatic cleanup
- **Cross-Platform Testing**: Platform-aware mocking supporting both Windows and POSIX behaviors

### Performance and Caching Validation
- **Binary Detection Caching**: Tests verify results are cached per adapter instance with proper invalidation
- **Executable Resolution Optimization**: PATH scanning with memoization to minimize filesystem access
- **Configuration Analysis Efficiency**: File parsing with error recovery and performance-conscious defaults

The test directory ensures the JavaScript debug adapter can reliably handle diverse development environments while maintaining excellent performance characteristics and providing clear, actionable feedback to developers when issues arise.