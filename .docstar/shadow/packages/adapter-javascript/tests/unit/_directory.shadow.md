# packages/adapter-javascript/tests/unit/
@generated: 2026-02-10T21:26:30Z

## Overall Purpose and Responsibility

This is the unit test directory for the `adapter-javascript` package, providing comprehensive test coverage for a JavaScript/TypeScript debug adapter implementation that integrates with the Debug Adapter Protocol (DAP). The tests validate the adapter's ability to detect, configure, and manage Node.js debugging sessions across different project configurations and environments.

## Key Components and Architecture

### Core Adapter Tests
- **JavascriptDebugAdapter**: Main adapter class with lifecycle management, DAP integration, error handling, and configuration transformation
- **JavascriptAdapterFactory**: Factory pattern implementation with environment validation and adapter instantiation
- **Factory Export**: Package entry point validation ensuring proper module exports

### Configuration and Detection Systems
- **Config Transformer**: Project analysis utilities for ESM detection, TypeScript path mapping, and output file determination
- **TypeScript Detector**: Binary discovery for ts-node/tsx runtime tools with PATH resolution and caching
- **Executable Resolver**: Cross-platform Node.js executable discovery with fallback mechanisms

### Build and Deployment Infrastructure
- **Vendor Strategy**: Environment-driven deployment planning for JavaScript debug server distribution
- **Build JS Debug Helpers**: Asset selection and path normalization utilities for GitHub release downloads

## Test Organization Patterns

### Base Test Files
Core functionality testing covering happy paths and standard use cases:
- `javascript-debug-adapter.*.test.ts` - Main adapter functionality 
- `config-transformer.test.ts` - Project configuration detection
- `typescript-detector.test.ts` - Runtime binary discovery
- `executable-resolver.test.ts` - Node.js executable resolution

### Edge Case Coverage
`*.edge.test.ts` files test boundary conditions, error recovery, and less common code paths:
- Malformed JSON handling in configuration files
- FileSystem operation failures and exception recovery
- Complex PATH resolution scenarios
- Platform-specific executable detection edge cases

### Error Handling Tests
`*.throw.edge.test.ts` files validate fault tolerance when dependencies throw exceptions:
- FileSystem operation failures
- Environment variable corruption
- Missing binary scenarios

## Public API Surface

### Main Entry Points
- **JavascriptAdapterFactory**: Primary factory for adapter creation with validation
- **JavascriptDebugAdapter**: Core adapter implementing IDebugAdapter interface
- **Configuration utilities**: ESM detection, TypeScript support analysis, output file determination

### Key Capabilities
- **DAP Protocol Integration**: Request/response handling, event processing, state management
- **Multi-Runtime Support**: Node.js, tsx, ts-node with automatic detection and configuration
- **Cross-Platform Compatibility**: Windows/POSIX executable resolution and path handling
- **Environment Validation**: Node.js version checking, vendor file verification, TypeScript tooling detection

## Internal Organization and Data Flow

### Initialization Flow
1. **Environment Validation**: Check Node.js version, vendor files, TypeScript runners
2. **Configuration Analysis**: Detect ESM projects, TypeScript paths, determine output patterns
3. **Executable Resolution**: Locate Node.js binary with preference hierarchy and caching
4. **Adapter Setup**: Configure DAP communication, prepare launch configurations

### Configuration Transformation Pipeline
1. **Project Detection**: Analyze package.json and tsconfig.json for project characteristics
2. **Runtime Selection**: Choose between Node.js, tsx, ts-node based on file extensions and availability
3. **Argument Assembly**: Build runtime arguments with TypeScript hooks, source map settings, path resolution
4. **Environment Merging**: Combine user and default environment variables

### Error Handling Strategy
- **Graceful Degradation**: Functions return sensible defaults rather than throwing on filesystem errors
- **User-Friendly Messages**: Error translation from technical to actionable guidance
- **Installation Assistance**: Automatic generation of dependency installation instructions

## Important Patterns and Conventions

### Mock Infrastructure
- **FileSystem Abstraction**: Dependency injection pattern enabling filesystem operation mocking
- **Environment Isolation**: PATH and NODE_OPTIONS manipulation with cleanup restoration
- **Cross-Platform Testing**: Platform-aware mocking for Windows vs POSIX behavior

### Test Categories
- **Lifecycle Tests**: State transitions, event emission, initialization/disposal
- **Protocol Tests**: DAP request/response handling, event processing
- **Configuration Tests**: Launch config transformation, TypeScript integration
- **Platform Tests**: Executable resolution across Windows/Unix systems

### Caching and Performance
- **Binary Detection Caching**: Results cached per adapter instance with cache invalidation
- **Executable Resolution**: PATH scanning with memoization to avoid repeated filesystem access
- **Configuration Analysis**: File parsing with error recovery and sensible defaults

The test suite ensures the adapter can reliably debug JavaScript and TypeScript applications across diverse development environments while providing clear error messages and installation guidance when dependencies are missing or misconfigured.