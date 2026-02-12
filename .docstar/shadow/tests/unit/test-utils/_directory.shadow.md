# tests\unit\test-utils/
@generated: 2026-02-12T21:00:59Z

## Purpose
Test utilities module providing comprehensive mock generation, validation, and specialized testing infrastructure for the debugging system. Enables type-safe, deterministic testing by offering automated mock creation, interface validation, pre-configured component mocks, and test-optimized implementations of core services.

## Key Components and Integration

### Core Mock Generation (`auto-mock.ts`)
**Primary entry point** for creating type-safe mocks from real implementations:
- `createMockFromInterface<T>()` - Main mock generator with prototype chain traversal and method conversion
- `validateMockInterface()` - Ensures mock-real interface consistency with comprehensive validation
- `createValidatedMock()` - Combines creation and validation in single operation
- `autoValidateMock()` - Lazy validation using Proxy pattern for performance optimization

### Component Mock Factories (`mock-factories.ts`) 
**Standardized mock implementations** for system components with sensible defaults:
- Process mocks (ChildProcess, ProxyProcess, Python validation processes)
- Service mocks (SessionManager, AdapterRegistry, NetworkManager) 
- Infrastructure mocks (Logger, FileSystem, Environment, WhichFinder)
- All return success-oriented defaults to enable positive test paths

### Test Infrastructure (`test-proxy-manager.ts`)
**Specialized test implementation** of ProxyManager that overrides complex runtime behavior:
- Synchronous initialization and cleanup for deterministic testing
- Mock DAP request/response simulation with configurable responses
- Event injection capabilities for testing message handling and debugging states
- Maintains parent class compatibility while enabling controlled testing scenarios

### Validation Suite (`mock-validation.test.ts`)
**Comprehensive test coverage** demonstrating proper usage patterns and validating the mock generation utilities themselves.

## Public API Surface

### Primary Entry Points
- `createMockFromInterface<T>(target, options?)` - Generate typed mocks from classes/objects
- `validateMockInterface(mock, realClass, options?)` - Validate mock completeness
- `createValidatedMock<T>(target, options?)` - One-step mock creation with validation
- `createEventEmitterMock<T>(additionalMethods?)` - Specialized EventEmitter mocking

### Factory Functions
- Process factories: `createMockChildProcess()`, `createMockProxyProcess()`, `createPythonValidationProcess()`
- Service factories: `createMockSessionManager()`, `createMockAdapterRegistry()`, `createMockNetworkManager()`
- Infrastructure factories: `createMockLogger()`, `createMockFileSystem()`, `createMockEnvironment()`

### Test Infrastructure
- `TestProxyManager` class for controlled ProxyManager testing
- Mock response configuration and message injection utilities

## Internal Organization and Data Flow

1. **Mock Generation Flow**: `createMockFromInterface` → prototype traversal → method conversion → validation → typed mock object
2. **Validation Flow**: Interface comparison → missing member detection → type checking → error/warning reporting
3. **Factory Pattern**: Pre-configured mocks with consistent return values and EventEmitter inheritance where appropriate
4. **Test Integration**: Specialized implementations override complex behaviors while preserving interfaces

## Important Patterns and Conventions

- **Type Safety**: Heavy use of TypeScript generics and conditional types for compile-time safety
- **Lazy Validation**: Proxy-based validation deferral to optimize test setup performance  
- **Success-Oriented Defaults**: All mocks return positive outcomes unless specifically configured otherwise
- **EventEmitter Integration**: Proper event-driven mock implementations with method chaining support
- **Prototype Chain Respect**: Comprehensive inheritance handling with configurable inclusion options
- **Vitest Integration**: Deep integration with Vitest framework (vi.fn(), Mock types) for seamless testing

## Critical Dependencies
- **Vitest**: Core testing framework for mock function creation and test execution
- **Node.js EventEmitter**: Event-driven patterns for process and service mocks
- **TypeScript**: Advanced type system features for type-safe mock generation
- **Real System Components**: Extends/mocks actual classes (ProxyManager, ChildProcess, etc.)

This module serves as the foundation for reliable, type-safe testing across the debugging system by providing automated mock generation with validation, standardized component mocks, and specialized test infrastructure that maintains interface compatibility while enabling deterministic testing scenarios.