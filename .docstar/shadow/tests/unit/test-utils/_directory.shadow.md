# tests/unit/test-utils/
@generated: 2026-02-09T18:16:10Z

## Test Utilities Directory

This directory provides a comprehensive testing infrastructure for creating, validating, and managing mocks in the Vitest testing environment, with specialized support for Node.js process mocking and debug adapter protocol (DAP) testing.

### Overall Purpose

The `test-utils` directory serves as the central hub for test infrastructure, providing:
- **Automated mock generation** with TypeScript interface validation
- **Factory functions** for complex Node.js and debugging-related mocks
- **Test-specific implementations** that override production classes for deterministic testing
- **Validation utilities** ensuring mock-interface compatibility

### Key Components and Organization

**Core Mock Generation (`auto-mock.ts`)**
- `createMockFromInterface<T>()`: Primary utility for auto-generating type-safe mocks from real implementations
- `validateMockInterface()`: Comprehensive interface compatibility validation
- `createValidatedMock()`: Combined creation and validation workflow
- `createEventEmitterMock()`: Specialized EventEmitter mock generation
- `autoValidateMock()`: Proxy-based lazy validation system

**Mock Factory Library (`mock-factories.ts`)**
- Process mocks: `createMockChildProcess()`, `createMockProxyProcess()`
- Session management: `createMockSessionManager()` with full debugging capabilities
- Infrastructure mocks: Logger, FileSystem, NetworkManager, Environment utilities
- Specialized process validators for Python environment testing

**Testing Infrastructure (`test-proxy-manager.ts`)**
- `TestProxyManager`: Extended ProxyManager for deterministic DAP testing
- Synchronous overrides of complex async initialization
- Mock DAP response simulation and event injection
- Helper factories for testing dependencies

### Public API Surface

**Primary Entry Points:**
```typescript
// Auto-mock generation
createMockFromInterface<T>(target, options?)
createValidatedMock<T>(target, options?)
createEventEmitterMock<T>(target, methods?)

// Factory functions
createMockChildProcess()
createMockSessionManager()
createMockAdapterRegistry()
// ... plus specialized process and infrastructure mocks

// Test implementations
TestProxyManager // Extended ProxyManager for testing
```

### Internal Data Flow

1. **Mock Creation Pipeline**: Interface analysis → Method enumeration → Vitest spy generation → Optional validation
2. **Factory Pattern**: Pre-configured mocks with realistic defaults → Type-safe returns → Event simulation capabilities
3. **Test Orchestration**: Production class extension → Complex behavior override → Deterministic test execution

### Key Patterns and Conventions

**Type Safety First**
- All mocks maintain TypeScript interface contracts
- Generic typing preserves original class signatures
- Compile-time validation prevents interface drift

**Vitest Integration**
- Consistent use of `vi.fn()` for method mocking
- Spy function validation with `vi.isMockFunction()`
- Proper cleanup and restoration patterns

**Event-Driven Testing**
- EventEmitter-based mocks for Node.js patterns
- Event simulation methods for testing async flows
- Immediate event emission for synchronous testing

**Configuration Flexibility**
- Method exclusion via regex or arrays
- Custom return value configuration
- Prototype chain traversal control
- Lazy validation options

### Dependencies

- **vitest**: Core testing framework and spy functions
- **@vscode/debugprotocol**: DAP types for debugging infrastructure
- **events**: Node.js EventEmitter for event-based mocks
- **child_process**: Node.js process types for system integration testing

### Critical Design Principles

- **Interface Preservation**: Generated mocks exactly match original class interfaces
- **Deterministic Testing**: Overrides eliminate timing and environment dependencies  
- **Comprehensive Coverage**: Factory functions cover all major system components
- **Error Categorization**: Distinguishes critical errors from warnings for better developer experience
- **Lazy Loading**: Defers expensive operations until actually needed in tests