# tests/unit/test-utils/
@generated: 2026-02-10T21:26:20Z

## Purpose
The `test-utils` directory provides a comprehensive testing infrastructure for creating, validating, and configuring mocks in the debugger system. It ensures type-safe, consistent test environments by offering automatic mock generation utilities, standardized factory functions for common system components, and specialized test implementations of complex classes.

## Core Components

### Mock Generation & Validation (`auto-mock.ts`)
The foundational layer providing intelligent mock creation from TypeScript interfaces:
- **`createMockFromInterface<T>`**: Core function that automatically generates type-safe mocks from real implementations, walking prototype chains and converting methods to Vitest spies
- **`validateMockInterface`**: Ensures mock-real interface consistency with comprehensive validation checks
- **`createValidatedMock`**: Combines creation and validation for guaranteed interface compliance  
- **`autoValidateMock`**: Lazy validation using Proxy pattern to defer overhead until first access

### Standardized Mock Factories (`mock-factories.ts`)
Pre-configured factory functions for consistent mocks across test suites:
- **Process Mocks**: `createMockChildProcess`, `createMockProxyProcess`, Python validation processes
- **Service Mocks**: `createMockSessionManager`, `createMockAdapterRegistry`, `createMockNetworkManager`
- **Infrastructure Mocks**: `createMockLogger`, `createMockFileSystem`, `createMockEnvironment`

### Test Implementation (`test-proxy-manager.ts`)
Specialized test-friendly implementation of ProxyManager that replaces complex initialization with synchronous, deterministic behavior:
- Overrides DAP communication with mock responses
- Provides message injection and state simulation capabilities
- Maintains parent class compatibility while enabling controlled testing

## Public API Surface

### Primary Entry Points
- **Mock Generation**: `createMockFromInterface`, `validateMockInterface`, `createValidatedMock`
- **Factory Functions**: All `createMock*` functions for standardized component mocks
- **Test Classes**: `TestProxyManager` for integration testing scenarios

### Key Patterns
- **Type Safety**: Heavy use of TypeScript generics ensuring mock-interface alignment
- **Configuration-Driven**: Flexible options for customizing mock behavior (exclusions, defaults, inheritance)
- **Success-Oriented Defaults**: All factories return positive-path defaults to enable straightforward testing

## Internal Organization

### Data Flow
1. **Mock Creation**: `auto-mock.ts` generates mocks through prototype introspection
2. **Validation**: Interface consistency checked before mock usage
3. **Factory Application**: Standardized mocks created via `mock-factories.ts` functions
4. **Test Integration**: Complex components use specialized test implementations like `TestProxyManager`

### Component Relationships
- **auto-mock.ts** provides the foundational mock generation engine
- **mock-factories.ts** builds on auto-mock utilities to create domain-specific mocks
- **test-proxy-manager.ts** demonstrates integration patterns for complex EventEmitter-based services
- All components work together to support the comprehensive test suite in `mock-validation.test.ts`

## Architecture Patterns

### Mock Lifecycle
1. **Creation**: Automatic generation from real implementations with configurable options
2. **Validation**: Interface compliance checking with error/warning reporting  
3. **Usage**: Type-safe mock objects with Vitest spy functions
4. **Cleanup**: Proper teardown through standard Vitest patterns

### Key Conventions
- EventEmitter inheritance for process and service mocks
- Consistent async operation responses (`{ success: true }` objects)
- Prototype chain traversal with system method exclusion
- Lazy evaluation patterns for performance optimization

This directory serves as the testing foundation for the entire debugger system, providing the tools and patterns necessary for reliable, maintainable test suites while ensuring mocks stay synchronized with evolving real implementations.