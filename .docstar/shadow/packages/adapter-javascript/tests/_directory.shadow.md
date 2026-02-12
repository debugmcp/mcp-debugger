# packages/adapter-javascript/tests/
@generated: 2026-02-11T23:48:00Z

## Purpose

The `packages/adapter-javascript/tests` directory contains a comprehensive test suite that validates the JavaScript debug adapter package's integration with VS Code's Debug Adapter Protocol (DAP) for Node.js and TypeScript debugging. The tests ensure robust functionality across diverse development environments and maintain protocol compliance for debugging JavaScript and TypeScript applications.

## Key Components and Integration

### Test Organization Structure
The directory is organized around the **unit** subdirectory which contains systematic testing of all adapter components:

- **Core Adapter Testing**: Factory creation, lifecycle management, and DAP protocol handling
- **Configuration Processing**: Launch config transformation, TypeScript detection, and runtime discovery  
- **Utility Module Validation**: Cross-platform executable resolution, TypeScript tooling detection, and ESM project analysis
- **Build System Testing**: Asset selection and deployment strategy validation

### Component Relationships
The tests validate a complete integration flow:
1. **Environment Validation** → **Configuration Transformation** → **Process Management** → **DAP Integration** → **Error Handling**
2. Tests ensure each component properly interfaces with others through dependency injection and mock abstractions
3. Mock infrastructure (MockFileSystem, environment isolation) enables isolated testing while maintaining realistic integration scenarios

## Public API Surface

The test suite validates these primary entry points:

- **`JavascriptAdapterFactory`**: Main factory for creating adapter instances with environment validation
- **`JavascriptDebugAdapter`**: Core adapter implementing IDebugAdapter interface with full DAP support
- **Configuration Utilities**: ESM detection, TypeScript path mapping, and launch configuration enrichment
- **Runtime Resolution**: Cross-platform Node.js executable discovery with intelligent caching
- **Error Translation**: User-friendly error messaging with actionable installation guidance

## Internal Organization and Data Flow

### Testing Methodology
Tests are categorized by validation type:
- **Happy Path Tests** (`.test.ts`): Standard functionality validation
- **Edge Case Tests** (`.edge.test.ts`): Boundary conditions and unusual inputs  
- **Error Handling Tests** (`.throw.edge.test.ts`): Exception scenarios and fault tolerance

### Mock Infrastructure and Patterns
- **Filesystem Abstraction**: Configurable file operations simulation
- **Environment Safety**: Process environment isolation preventing test pollution
- **Cross-platform Compatibility**: Windows/POSIX path handling and executable resolution
- **Dependency Injection**: Pluggable components for filesystem, logging, and process launching

## Important Patterns and Conventions

### Robustness Testing
- **Cross-platform executable discovery** with PATH precedence and caching validation
- **Graceful degradation** when preferred tools (TypeScript, ts-node) are unavailable
- **Event-driven DAP protocol** testing with state transition validation
- **Exception safety** ensuring filesystem errors don't crash the adapter

### Real-world Environment Simulation
Tests validate adapter behavior across varying:
- Node.js versions and installation patterns
- TypeScript configuration setups (tsx, ts-node, native tooling)
- System configurations and development environment variations
- Network conditions and external dependency availability

The test suite ensures the JavaScript debug adapter maintains reliable operation and DAP compliance across the diverse landscape of JavaScript/TypeScript development environments while providing excellent developer experience through robust error handling and configuration management.