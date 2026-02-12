# packages/adapter-javascript/tests/unit/
@generated: 2026-02-11T23:47:45Z

## Purpose

This directory contains comprehensive unit tests for the JavaScript debug adapter package, validating all core functionality from configuration transformation to debug session lifecycle management. The tests ensure the adapter properly integrates with VS Code's Debug Adapter Protocol (DAP) for Node.js and TypeScript debugging scenarios.

## Key Components

### Core Adapter Testing
- **Factory & Lifecycle Tests**: `factory-export.test.ts`, `javascript-adapter-factory.*.test.ts` validate adapter creation, initialization, and environment validation
- **Runtime Integration**: `javascript-debug-adapter.*.test.ts` files test DAP protocol handling, command building, connection management, and error handling
- **Configuration Processing**: Tests for launch configuration transformation, TypeScript detection, and Node.js runtime discovery

### Utility Module Testing
- **Configuration Transformer**: Tests for `config-transformer.*.test.ts` validate ESM project detection, TypeScript path mapping, and output file pattern determination
- **Executable Resolution**: Tests for `executable-resolver.*.test.ts` verify cross-platform Node.js executable discovery with PATH precedence
- **TypeScript Detection**: Tests for `typescript-detector.*.test.ts` validate tsx/ts-node binary discovery and caching
- **Vendor Strategy**: Tests for deployment strategy selection based on environment variables

### Build System Testing
- **Debug Helper Tests**: `build-js-debug.helpers.test.ts` validates asset selection logic for GitHub releases and path normalization utilities

## Public API Surface

The tests validate these primary entry points:
- **`JavascriptAdapterFactory`**: Main factory class for creating adapter instances
- **`JavascriptDebugAdapter`**: Core adapter implementing IDebugAdapter interface with DAP support
- **Configuration utilities**: ESM detection, TypeScript tooling discovery, and launch config transformation
- **Runtime resolution**: Cross-platform Node.js executable discovery with caching

## Internal Organization

### Test Categories by Coverage Type
1. **Happy Path Tests**: Standard functionality validation (`.test.ts` files)
2. **Edge Case Tests**: Boundary conditions and unusual inputs (`.edge.test.ts` files) 
3. **Error Handling Tests**: Exception scenarios and fault tolerance (`.throw.edge.test.ts` files)

### Mock Infrastructure
- **MockFileSystem**: Standardized filesystem abstraction for testing file operations
- **Environment Isolation**: PATH and NODE_OPTIONS manipulation with cleanup
- **Dependency Injection**: Configurable adapter dependencies for isolated testing

## Data Flow

Tests validate this integration flow:
1. **Environment Validation**: Node.js version checks, vendor file presence, TypeScript tooling availability
2. **Configuration Transformation**: Launch configs enriched with source maps, TypeScript hooks, and runtime arguments
3. **Process Management**: Node.js executable discovery, command building with memory flags
4. **DAP Integration**: Request/response handling, event processing, state management
5. **Error Handling**: User-friendly error translation and installation guidance

## Important Patterns

### Testing Patterns
- **Cross-platform compatibility**: Windows/POSIX path handling and executable extensions
- **Caching validation**: Executable resolution and binary detection caching behavior
- **Event-driven testing**: DAP event emission and adapter state transitions
- **Environment safety**: Process environment isolation to prevent test pollution

### Mock Strategies
- **Filesystem abstraction**: Configurable file existence and content simulation
- **External command mocking**: TypeScript binary detection and Node.js executable discovery
- **Dependency injection**: Pluggable filesystem, logger, and process launcher implementations

### Error Boundary Testing
- **Graceful degradation**: Fallback behaviors when preferred tools unavailable
- **Exception safety**: File system errors don't crash the adapter
- **User guidance**: Actionable error messages with installation instructions

The test suite ensures the JavaScript debug adapter robustly handles real-world development environments with varying Node.js versions, TypeScript configurations, and system setups while maintaining DAP protocol compliance.