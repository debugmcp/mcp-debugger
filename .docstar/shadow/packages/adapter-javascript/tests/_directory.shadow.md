# packages/adapter-javascript/tests/
@generated: 2026-02-09T18:16:38Z

## Purpose and Responsibility

This directory contains the comprehensive test suite for the JavaScript Debug Adapter package, providing extensive validation coverage for debugging Node.js and TypeScript applications through the Debug Adapter Protocol (DAP). The tests ensure the adapter's reliability across platforms, configuration scenarios, and error conditions while maintaining strict isolation and comprehensive edge case coverage.

## Key Components and Organization

### Core Test Architecture
The test suite is organized into two primary layers:
- **Unit tests** (`unit/`): Isolated validation of individual components with extensive mocking
- **Hierarchical test organization**: Primary functionality tests, edge case variants (`.edge.test.ts`), and exception handling suites (`.throw.edge.test.ts`)

### Primary Test Coverage Areas

**Adapter Core Testing**
- `javascript-debug-adapter.test.ts` family: Complete lifecycle validation of the main `JavascriptDebugAdapter` class
  - DAP protocol compliance and message handling
  - State transitions (UNINITIALIZED → INITIALIZING → READY → CONNECTED → DEBUGGING)
  - Configuration transformation and environment variable management
  - Connection lifecycle and event emission patterns

**Utility Module Validation**
- `config-transformer.test.ts`: ESM/CommonJS detection, TypeScript configuration analysis
- `executable-resolver.test.ts`: Cross-platform Node.js runtime discovery with PATH precedence
- `typescript-detector.test.ts`: tsx/ts-node tooling detection and caching behavior
- `vendor-strategy.test.ts`: Build-time dependency vendoring strategies

**Factory and Integration Testing**
- `javascript-adapter-factory.test.ts`: Environment validation, dependency checking, adapter instantiation
- `factory-export.test.ts`: Package interface compliance and export validation

## Test Patterns and Conventions

### Mock-Based Isolation Strategy
All tests employ comprehensive mocking through Vitest framework:
- **FileSystem abstraction**: MockFileSystem implementations prevent side effects
- **Environment isolation**: Temporary PATH/NODE_OPTIONS manipulation with guaranteed cleanup
- **External dependency mocking**: Isolated testing of configuration and executable resolution logic

### Cross-Platform Reliability
Tests ensure Windows/POSIX compatibility through:
- Platform-aware path normalization utilities (`norm()` helpers)
- Conditional test logic based on platform detection
- Executable suffix handling (.exe, .cmd variants on Windows)

### Comprehensive Edge Case Coverage
Dedicated edge test suites validate:
- Malformed configuration file resilience
- Filesystem operation failures and exception handling
- Environment variable type coercion and boundary conditions
- Cache invalidation and cleanup scenarios

## Public API Validation Surface

The test suite comprehensively validates the adapter's public interface:

**Primary Entry Points**
- `JavascriptDebugAdapter`: Main adapter class with complete DAP protocol implementation
- `JavascriptAdapterFactory`: Factory class with environment validation and adapter creation

**Utility APIs**
- Configuration detection and transformation utilities
- Cross-platform executable resolution with fallback mechanisms  
- TypeScript tooling discovery and caching behavior
- Build asset selection and path normalization

## Data Flow and Integration Patterns

### Environment Detection Pipeline
Tests validate the complete flow: package.json analysis → TypeScript configuration detection → executable resolution → environment-specific argument construction

### State Management Validation
Comprehensive testing of adapter state transitions with proper event emission sequences and cleanup behavior validation

### Configuration Transformation Chain
End-to-end validation of launch configuration processing, from raw input through environment-specific transformation to final executable command construction

## Key Testing Invariants

The test suite maintains strict invariants around:
- **Environment isolation**: No mutation of global process environment
- **State consistency**: Proper cleanup and resource disposal in all scenarios
- **Cross-platform compatibility**: Validated behavior across Windows and POSIX systems
- **Error resilience**: Graceful handling of malformed inputs and system failures

This test directory ensures the JavaScript Debug Adapter can reliably debug applications across diverse environments while maintaining robust error handling and configuration flexibility.