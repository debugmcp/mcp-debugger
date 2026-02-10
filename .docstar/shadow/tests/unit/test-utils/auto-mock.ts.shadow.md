# tests/unit/test-utils/auto-mock.ts
@source-hash: 4500b84821bdf832
@generated: 2026-02-09T18:14:54Z

## Automatic Mock Generation Utilities

This module provides comprehensive utilities for generating, validating, and managing mocks in Vitest tests, particularly focused on ensuring mock-interface compatibility.

### Core Functions

**`createMockFromInterface<T>()` (L18-131)**
- Primary utility for auto-generating mocks from real implementations or class constructors
- Supports both instances and constructor functions as input
- Creates `vi.fn()` mocks for all methods, preserves property structure
- Features:
  - Method exclusion via regex or property name array (L24)
  - Default return value configuration (L27)
  - Prototype chain traversal control (L31)
  - Smart default returns for getter/boolean methods (L106-112)
  - Proper getter/setter property handling (L115-122)

**`validateMockInterface()` (L141-220)**
- Validates mock objects against their real implementations
- Performs comprehensive interface compatibility checking:
  - Missing member detection (L170-177)
  - Type compatibility validation (L183-185) 
  - Function arity comparison (L188-198)
  - Extra member detection (L203-207)
- Distinguishes between errors (interface violations) and warnings (suspicious patterns)
- Provides detailed error messages with remediation suggestions

**`createValidatedMock()` (L231-242)**
- Convenience wrapper combining mock creation and validation
- Ensures immediate validation after mock generation
- Returns type-safe mock with guaranteed interface compliance

### Specialized Mock Creators

**`createEventEmitterMock()` (L248-289)**
- Creates mocks for EventEmitter-based classes (common pattern in the codebase)
- Pre-configured with all standard EventEmitter methods (L269-285)
- Methods return appropriate default values (chains return `this`, emit returns `true`)
- Supports extension with additional methods via parameter

**`autoValidateMock()` (L307-334)**
- Proxy-based lazy validation system
- Validates mock interface on first property access rather than creation
- Caches validation result to avoid repeated checks
- Designed for use in test setup (beforeEach hooks)

### Key Dependencies
- `vitest` - Core testing framework, uses `vi.fn()` for mock creation
- Native JavaScript reflection APIs for prototype chain traversal

### Architecture Patterns
- **Type-safe mock generation**: Preserves TypeScript interface contracts
- **Lazy validation**: Defers expensive validation until mock usage
- **Flexible configuration**: Supports various mock customization scenarios
- **Error categorization**: Separates critical errors from warnings for better DX

### Critical Invariants
- All generated mocks maintain the same interface as their real counterparts
- Method mocks are created as `vi.fn()` instances for Vitest compatibility
- Prototype chain traversal respects inheritance hierarchies
- Validation failures provide actionable error messages