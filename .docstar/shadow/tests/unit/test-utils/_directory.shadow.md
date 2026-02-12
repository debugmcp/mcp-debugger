# tests/unit/test-utils/
@generated: 2026-02-11T23:47:41Z

## Purpose
The test-utils directory provides a comprehensive test infrastructure for creating and validating mocks in the debugger system. It combines automated mock generation capabilities with specialized test factories and validation utilities to ensure reliable, type-safe testing across the entire codebase.

## Key Components and Integration

### Auto-Mock System (`auto-mock.ts`)
Core engine providing intelligent mock generation from real implementations:
- **`createMockFromInterface<T>`**: Primary factory that generates type-safe mocks by traversing prototype chains and converting methods to `vi.fn()` spies
- **`validateMockInterface`**: Ensures mock-real interface consistency, catching missing methods or type mismatches
- **`createValidatedMock`**: One-step creation with immediate validation
- **Specialized mocks**: EventEmitter patterns and lazy validation via Proxy pattern

### Mock Factories (`mock-factories.ts`)
Provides pre-configured, standardized mocks for system components:
- **Process mocks**: Child processes, proxy processes, Python validation processes with proper EventEmitter behavior
- **Service mocks**: Session managers, adapter registries, network managers with success-oriented defaults
- **Infrastructure mocks**: Logging, filesystem, and environment detection utilities
- All factories return sensible defaults to enable positive test paths

### Test Infrastructure
- **`mock-validation.test.ts`**: Comprehensive test suite validating the auto-mock system itself with inheritance, EventEmitter, and integration scenarios
- **`test-proxy-manager.ts`**: Specialized test harness that overrides ProxyManager complexity for synchronous, deterministic testing

## Public API Surface

### Primary Entry Points
- **Mock Creation**: `createMockFromInterface`, `createValidatedMock`, `autoValidateMock`
- **Validation**: `validateMockInterface`
- **Specialized Factories**: `createEventEmitterMock` for event-driven components
- **Component Factories**: All `createMock*` functions for standardized system mocks
- **Test Harness**: `TestProxyManager` for controlled proxy testing

### Configuration Options
- Method exclusion patterns (regex or string arrays)
- Custom return value mapping
- Inheritance handling (`includeInherited`)
- Default return strategies for method naming conventions

## Internal Organization and Data Flow

1. **Mock Generation Flow**: Real class → prototype traversal → method conversion → validation → type-safe mock
2. **Validation Pipeline**: Interface comparison → error detection → warning classification → consistency reporting
3. **Factory Integration**: Auto-mock utilities → specialized factories → test-ready mocks
4. **Test Execution**: Mock creation → configuration → validation → test scenario execution

## Important Patterns and Conventions

### Type Safety Strategy
- Heavy use of TypeScript generics and conditional types
- Runtime validation ensuring mock-real interface consistency
- Vitest integration for proper Mock function types

### Mock Behavior Standards
- Success-oriented defaults for positive test paths
- EventEmitter inheritance for process and service mocks
- Consistent async patterns (nextTick for process simulation)
- Method chaining support where appropriate

### Configuration-Driven Design
- Flexible exclusion patterns for test-specific needs
- Standardized return value conventions
- Lazy evaluation for performance optimization

### Integration Points
- **Vitest Framework**: Core dependency for `vi.fn()` and Mock types
- **EventEmitter Pattern**: Specialized support for event-driven components
- **Prototype Introspection**: Deep reflection for comprehensive mock generation
- **DAP Protocol**: Specialized ProxyManager testing with mock DAP responses

## Critical Architecture Decisions
- Separation of generic mock generation from domain-specific factories
- Comprehensive validation to prevent test brittleness
- Proxy-based lazy validation for performance
- Pre-configured defaults to reduce test boilerplate
- Type-safe mock generation maintaining full interface compatibility