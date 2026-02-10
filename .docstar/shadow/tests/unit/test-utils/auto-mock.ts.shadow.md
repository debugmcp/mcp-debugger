# tests/unit/test-utils/auto-mock.ts
@source-hash: f23bd9aee71af25e
@generated: 2026-02-10T01:19:01Z

## Purpose
Provides automatic mock generation utilities for test environments, creating type-safe mocks from real implementations with validation capabilities. Integrates with Vitest testing framework to ensure mocks stay synchronized with actual interfaces.

## Core Functions

### `createMockFromInterface<T>` (L18-131)
Primary mock generation function that creates mocks from real implementations or class constructors:
- **Input**: Target object/class + configuration options (exclude patterns, default returns, inheritance)
- **Process**: Walks prototype chain, converts methods to `vi.fn()` mocks, preserves property structure
- **Output**: Mock object with same interface as target, all methods become Mock functions
- **Key features**: Handles getters/setters (L115-122), smart default returns for method naming patterns (L106-114), prototype chain traversal (L67-71)

### `validateMockInterface` (L141-220)
Validation function ensuring mock-real interface consistency:
- **Validation checks**: Missing members (L170-177), type compatibility (L183-185), function arity (L188-198)
- **Error handling**: Distinguishes errors vs warnings, reports private member discrepancies as warnings
- **Throws**: Error if critical mismatches found, suggesting use of `createMockFromInterface`

### `createValidatedMock` (L231-242)
Convenience wrapper combining mock creation with immediate validation, guaranteeing interface consistency.

### `createEventEmitterMock` (L248-289)
Specialized mock for EventEmitter pattern, common in the codebase:
- **Returns**: Complete EventEmitter interface with sensible defaults (chains return `this`, listeners return arrays)
- **Extensible**: Accepts additional methods via parameter

### `autoValidateMock` (L307-334)
Lazy validation decorator using Proxy pattern:
- **Strategy**: Defers validation until first method access
- **Use case**: Prevents test setup overhead while ensuring validation occurs
- **Implementation**: Proxy handler intercepts first property access to trigger validation

## Dependencies
- **Vitest**: Core testing framework (`vi`, `Mock` types)
- **Built-in**: Object reflection APIs for prototype traversal and property inspection

## Architecture Patterns
- **Type safety**: Heavy use of TypeScript generics and conditional types (L34)
- **Lazy evaluation**: Proxy-based validation deferral
- **Prototype introspection**: Comprehensive property discovery across inheritance chains
- **Configuration-driven**: Flexible options for customizing mock behavior

## Critical Constraints
- Requires Vitest environment (vi.fn() dependency)
- Mock validation assumes synchronous property access patterns
- Prototype chain traversal stops at Object.prototype to avoid system methods