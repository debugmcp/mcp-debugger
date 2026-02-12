# tests\unit\test-utils/
@generated: 2026-02-12T21:05:50Z

## Purpose
Test utilities directory providing comprehensive mock generation, validation, and specialized test implementations for debugging system components. Enables reliable, deterministic testing by automating mock creation, ensuring interface consistency, and providing test-friendly implementations of complex runtime components.

## Core Components

### Automatic Mock Generation (`auto-mock.ts`)
Central mock automation engine that creates type-safe mocks from real implementations:
- **`createMockFromInterface<T>`**: Primary mock generator with prototype chain traversal, method exclusion, and smart defaults
- **`validateMockInterface`**: Ensures mock-real interface consistency with comprehensive validation rules
- **`createValidatedMock`**: One-step mock creation with automatic validation
- **`createEventEmitterMock`**: Specialized EventEmitter pattern mocking
- **`autoValidateMock`**: Lazy validation using Proxy pattern for deferred overhead

### Mock Factory Library (`mock-factories.ts`)
Standardized mock implementations for core system components:
- **Process Mocks**: ChildProcess variants with EventEmitter inheritance and realistic defaults
- **Service Mocks**: SessionManager, AdapterRegistry, NetworkManager with success-oriented responses
- **Infrastructure Mocks**: Logger, FileSystem, Environment with consistent behavior patterns
- **Pre-configured Scenarios**: Python validation processes with predetermined exit codes

### Test Implementation (`test-proxy-manager.ts`)
Simplified test version of ProxyManager that overrides complex runtime behavior:
- **TestProxyManager**: Synchronous, deterministic version of real ProxyManager
- **Mock Response System**: Configurable DAP command responses for testing
- **Event Simulation**: Controlled debugging event emission (stopped, continued)
- **State Management**: Simplified thread and process state tracking

## Public API Surface

### Primary Entry Points
- **`createMockFromInterface<T>(target, options?)`**: Main mock generation function
- **`createValidatedMock<T>(target, options?)`**: Mock creation with immediate validation
- **Factory functions**: `createMockChildProcess()`, `createMockSessionManager()`, etc.
- **`TestProxyManager`**: Drop-in replacement for ProxyManager in tests

### Configuration Options
- **Mock behavior**: Exclude patterns, default returns, inheritance handling
- **Validation rules**: Error vs warning thresholds, type compatibility checks
- **Pre-built scenarios**: Success/failure process states, network configurations

## Internal Organization

### Data Flow
1. **Mock Generation**: `auto-mock.ts` creates type-safe mocks via reflection and prototype traversal
2. **Factory Integration**: `mock-factories.ts` provides domain-specific mocks using auto-mock utilities
3. **Test Implementation**: `test-proxy-manager.ts` extends real classes with mock-friendly overrides
4. **Validation Pipeline**: Ensures mock interfaces match real implementations throughout

### Component Relationships
- **auto-mock.ts** provides the foundation for all other mock utilities
- **mock-factories.ts** builds on auto-mock for domain-specific components
- **test-proxy-manager.ts** demonstrates integration patterns for complex class mocking
- **mock-validation.test.ts** validates the entire mock generation system

## Key Patterns

### Type Safety & Validation
- Comprehensive TypeScript generic usage for type preservation
- Runtime interface validation with detailed error reporting
- Mock method consistency checks (arity, return types)

### Event-Driven Architecture
- EventEmitter inheritance patterns for process and service mocks
- Controlled event emission for deterministic test scenarios
- Proper cleanup and lifecycle management in test implementations

### Configuration-Driven Behavior
- Flexible mock customization through options objects
- Success-oriented defaults for positive test path enablement
- Regex and array-based exclusion patterns for method filtering

## Dependencies
- **Vitest**: Core testing framework integration (`vi.fn()`, `Mock` types)
- **Node.js Built-ins**: EventEmitter, child_process, reflection APIs
- **Real System Classes**: ProxyManager and other production components for inheritance

## Critical Constraints
- Requires Vitest environment for mock function creation
- Assumes synchronous property access patterns for validation
- Test implementations maintain API compatibility while simplifying behavior
- Mock validation stops at Object.prototype to avoid system method pollution