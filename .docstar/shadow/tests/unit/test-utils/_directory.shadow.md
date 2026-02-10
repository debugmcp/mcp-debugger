# tests/unit/test-utils/
@generated: 2026-02-10T01:19:45Z

## Overall Purpose
Provides comprehensive testing utilities and mock generation infrastructure for the debugging system. This module serves as the testing foundation, offering automated mock creation, validation utilities, standardized factory functions, and test-specific implementations that enable reliable, deterministic testing of complex debugging components.

## Key Components and Integration

### Core Mock Generation (`auto-mock.ts`)
Central engine for automated mock creation from real implementations:
- **`createMockFromInterface`**: Primary entry point for generating type-safe mocks with prototype chain traversal
- **`validateMockInterface`**: Ensures mock-real interface consistency with comprehensive validation
- **`createValidatedMock`**: One-step convenience wrapper combining creation and validation
- **`autoValidateMock`**: Lazy validation using Proxy pattern for performance optimization

### Standardized Mock Factories (`mock-factories.ts`)
Pre-configured factory functions for common system components:
- **Process mocks**: Child processes, proxy processes, Python validation processes
- **Service mocks**: Session managers, adapter registries, network managers
- **Infrastructure mocks**: Loggers, file systems, environment detection
- All factories provide success-oriented defaults to enable positive test paths

### Test-Specific Implementations (`test-proxy-manager.ts`)
Specialized test doubles that override complex runtime behavior:
- **TestProxyManager**: Synchronous, deterministic ProxyManager implementation
- Mock response configuration and state simulation capabilities
- Maintains full interface compatibility while eliminating external dependencies

### Validation and Testing (`mock-validation.test.ts`)
Comprehensive test suite validating the mock generation utilities themselves:
- Interface compliance testing with inheritance handling
- Validation rule verification and error detection
- Integration testing with real-world usage patterns

## Public API Surface

### Primary Entry Points
- **`createMockFromInterface<T>`**: Generate typed mocks from classes/objects
- **`createValidatedMock<T>`**: Create and validate mocks in one step
- **Factory functions**: `createMockChildProcess`, `createMockSessionManager`, `createMockLogger`, etc.
- **`TestProxyManager`**: Test-friendly ProxyManager implementation

### Configuration Options
- Method exclusion patterns (regex or arrays)
- Custom return value configuration
- Inheritance chain inclusion/exclusion
- EventEmitter-specific mock extensions

## Internal Organization and Data Flow

### Mock Generation Pipeline
1. **Interface Analysis**: Prototype chain traversal to discover all methods and properties
2. **Mock Creation**: Convert methods to `vi.fn()` spies with intelligent defaults
3. **Validation**: Compare mock interface against original for consistency
4. **Specialization**: Apply domain-specific behaviors (EventEmitter patterns, etc.)

### Integration Patterns
- **Factory → Auto-mock**: Standard factories use core mock generation utilities
- **Test classes → Validation**: Test implementations validate against real interfaces
- **Mock validation → Test suite**: Self-testing ensures mock generation reliability

## Important Patterns and Conventions

### Type Safety First
- Heavy use of TypeScript generics for compile-time interface matching
- Conditional types for method signature preservation
- Mock validation prevents runtime interface drift

### Lazy Evaluation
- Proxy-based validation deferral to optimize test performance
- Just-in-time mock response configuration for TestProxyManager

### Success-Oriented Defaults
- All factory mocks return success states by default
- Boolean methods default to `false`, object methods to `undefined`
- Async operations return `{ success: true }` objects

### Event-Driven Testing
- EventEmitter inheritance for process and service mocks
- Automatic event emission for process lifecycle simulation
- Deterministic timing using `process.nextTick()`

## Dependencies and Environment
- **Vitest ecosystem**: Core testing framework integration (`vi.fn()`, `Mock` types)
- **Node.js built-ins**: EventEmitter, child_process types, prototype reflection APIs
- **Type definitions**: VSCode Debug Protocol for DAP testing support

This module enables reliable testing by providing consistent, validated mocks that stay synchronized with real implementations while offering the flexibility needed for comprehensive test scenarios.