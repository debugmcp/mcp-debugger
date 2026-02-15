# tests\core\unit\utils/
@children-hash: 2659bc8d5f5ce586
@generated: 2026-02-15T09:01:24Z

## Purpose
Unit test directory for core utility functions in the debugmcp system. Contains comprehensive test suites that validate critical runtime safety mechanisms and API migration compliance for session management and data validation utilities.

## Key Components

### Session Migration Testing (`session-migration.test.ts`)
- **Purpose**: Validates complete migration from deprecated `pythonPath` to `executablePath` parameter
- **Coverage**: Session creation, multi-language support, platform defaults, API interface consistency
- **Focus**: Ensures backward compatibility removal and new parameter adoption across all debug languages

### Type Guard Testing (`type-guards.test.ts`) 
- **Purpose**: Validates runtime type safety for critical data structures at system boundaries
- **Coverage**: AdapterCommand validation, ProxyInitPayload validation, serialization safety, factory functions
- **Focus**: Runtime type checking, error handling, performance validation, logging utilities

## Public API Surface
The tests validate utilities that provide:
- **Session Management**: `SessionStore`, `CreateSessionParams` with `executablePath` parameter
- **Type Guards**: `isValidAdapterCommand()`, `validateAdapterCommand()`, `hasValidAdapterCommand()`, `validateProxyInitPayload()`
- **Serialization**: `serializeAdapterCommand()`, `deserializeAdapterCommand()`
- **Factories**: `createAdapterCommand()` with safe defaults
- **Accessors**: `getAdapterCommandProperty()` with fallback handling
- **Logging**: `logAdapterCommandValidation()` with structured output

## Internal Organization & Data Flow
1. **Migration Validation**: Tests ensure old APIs are completely removed and new APIs work across all supported languages (Python, Mock)
2. **Boundary Protection**: Type guards validate data at critical system boundaries (IPC, serialization, network)
3. **Error Handling**: Comprehensive validation with detailed error messages including source context and expected structures
4. **Performance**: Large dataset validation ensures type guards remain performant under load

## Important Patterns

### Testing Patterns
- **Environment isolation**: Setup/teardown with environment variable management
- **Console spy patterns**: Systematic logging validation with beforeEach/afterEach hooks
- **Type narrowing validation**: TypeScript compiler integration to verify type guard effectiveness
- **Round-trip testing**: Serialization consistency validation
- **Performance benchmarking**: Large dataset validation timing

### Safety Patterns
- **Progressive validation**: From simple type checks to complex structure validation
- **Source-aware errors**: Error messages include context about data source and validation point
- **Default fallbacks**: Safe property access with logging when validation fails
- **Optional field handling**: Proper validation of optional vs required fields in complex structures

### Migration Patterns
- **Platform abstraction**: Executable path defaults for different operating systems
- **Multi-language support**: Consistent parameter handling across debug language types
- **API completeness**: Verification that migration affects all relevant interfaces consistently

## Dependencies
- `vitest` framework with mocking and performance testing capabilities
- `@debugmcp/shared` package for core type definitions (DebugLanguage, AdapterCommand)
- Session management modules from `src/session/`
- Console and timer mocking for deterministic test execution

This test suite ensures the utility layer provides robust runtime safety and maintains API consistency during system evolution.