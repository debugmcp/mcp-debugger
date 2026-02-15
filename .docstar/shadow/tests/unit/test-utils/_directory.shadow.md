# tests\unit\test-utils/
@children-hash: 065b3d20082f309b
@generated: 2026-02-15T09:01:31Z

## Purpose
This directory provides comprehensive testing utilities for creating, validating, and managing mock objects in the test environment. It serves as the foundational mocking infrastructure that ensures test reliability through automated mock generation, interface validation, and standardized test fixtures.

## Core Components and Architecture

### Mock Generation Engine (`auto-mock.ts`)
The centerpiece of the testing infrastructure, providing intelligent mock creation:
- **`createMockFromInterface<T>`**: Primary mock generator that creates type-safe mocks from real implementations using prototype introspection
- **`validateMockInterface`**: Ensures mock-implementation consistency through comprehensive interface validation
- **`createValidatedMock`**: One-stop solution combining generation with immediate validation
- **`autoValidateMock`**: Lazy validation using Proxy pattern for performance optimization
- **`createEventEmitterMock`**: Specialized factory for EventEmitter-based components

### Standardized Mock Factories (`mock-factories.ts`)
Pre-configured mock implementations for core system components:
- **Process mocks**: Child processes, proxy processes, and Python validation processes with realistic behavior
- **Service mocks**: Session managers, adapter registries, network managers with success-oriented defaults
- **Infrastructure mocks**: Loggers, file systems, and environment detection utilities
- All factories return consistent, test-friendly defaults to enable positive test paths

### Test Implementation Utilities (`test-proxy-manager.ts`)
Specialized test doubles for complex components:
- **TestProxyManager**: Simplified ProxyManager implementation that replaces complex initialization with synchronous, deterministic behavior
- **Mock response simulation**: Configurable DAP command responses and event injection
- **State management**: Thread simulation and debugging state control for integration testing

## Public API Surface

### Primary Entry Points
- **`createMockFromInterface<T>(target, options?)`**: Generate validated mocks from any class or object
- **`validateMockInterface(mockObj, realClass)`**: Validate existing mocks against implementations
- **Factory functions**: `createMock*()` functions for standard system components
- **TestProxyManager**: Drop-in replacement for ProxyManager in tests

### Configuration Options
- **Exclusion patterns**: Regex or string arrays to exclude specific methods/properties
- **Custom defaults**: Override return values for specific method patterns
- **Inheritance control**: Include/exclude inherited members from mocks
- **Validation modes**: Error vs warning handling for interface mismatches

## Internal Organization and Data Flow

### Mock Creation Pipeline
1. **Introspection**: Walk prototype chain to discover all properties and methods
2. **Filtering**: Apply exclusion patterns and inheritance rules
3. **Mock generation**: Convert methods to `vi.fn()` with smart defaults
4. **Validation**: Ensure mock interface matches real implementation
5. **Enhancement**: Add specialized behavior for EventEmitter patterns

### Integration Patterns
- **Vitest integration**: All mocks use `vi.fn()` for proper test framework integration
- **Type safety**: Heavy use of TypeScript generics ensures compile-time correctness
- **Lazy evaluation**: Proxy-based validation deferral prevents test setup overhead
- **Event-driven testing**: Specialized support for EventEmitter-based components

## Key Testing Patterns

### Validation Strategy
- **Interface consistency**: Automated detection of mock-implementation drift
- **Type compatibility**: Ensures mock methods match expected signatures  
- **Graceful degradation**: Private member mismatches generate warnings, not failures
- **Smart defaults**: Boolean methods return `false`, object methods return `undefined`

### Factory Standardization
- **Success-oriented defaults**: All operations return success states for positive testing
- **Realistic values**: Hard-coded but believable defaults (ports, PIDs, paths)
- **Event simulation**: Proper async behavior simulation using `nextTick`
- **Method chaining**: Support for fluent interfaces where appropriate

## Dependencies and Constraints
- **Vitest environment**: Requires `vi.fn()` and mock utilities
- **Node.js EventEmitter**: Extensive use for event-driven component testing
- **TypeScript**: Heavy reliance on type system for compile-time safety
- **Synchronous assumptions**: Mock validation assumes sync property access patterns

This module serves as the backbone of the test infrastructure, ensuring reliable, maintainable, and type-safe testing through automated mock management and validation.