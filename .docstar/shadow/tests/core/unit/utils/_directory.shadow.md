# tests/core/unit/utils/
@generated: 2026-02-10T21:26:20Z

## Overall Purpose
This directory contains unit tests for core utility functions in the debugmcp system, focusing on two critical areas: **session parameter migration** and **type safety validation**. The tests ensure API evolution integrity and runtime type safety at system boundaries.

## Key Components and Integration

### Session Migration Testing (`session-migration.test.ts`)
Validates the deprecation of `pythonPath` in favor of `executablePath` across the session management system:
- **Migration verification**: Ensures TypeScript compilation prevents old API usage
- **Multi-language support**: Tests executable path handling for Python and Mock debug languages
- **Platform defaults**: Validates platform-specific executable resolution (python vs python3)
- **API completeness**: Confirms migration across CreateSessionParams, ProxyConfig, and ProxyInitPayload interfaces

### Type Safety Validation (`type-guards.test.ts`)
Comprehensive testing of runtime type guards that protect critical data boundaries:
- **AdapterCommand validation**: Tests `isValidAdapterCommand`, `validateAdapterCommand` type guards
- **ProxyInitPayload validation**: Tests complete payload structure validation including optional fields
- **Serialization safety**: Tests `serializeAdapterCommand` and `deserializeAdapterCommand` with error handling
- **Factory functions**: Tests `createAdapterCommand` builder with input validation
- **Safe accessors**: Tests `getAdapterCommandProperty` with fallback handling
- **Logging utilities**: Tests structured validation logging with conditional output

## Public API Surface
The tests validate these key utility entry points:
- **Session Management**: `SessionStore` class, `CreateSessionParams` interface
- **Type Guards**: `isValidAdapterCommand()`, `validateAdapterCommand()`, `hasValidAdapterCommand()`
- **Validation**: `validateProxyInitPayload()` for complete payload checking
- **Serialization**: `serializeAdapterCommand()`, `deserializeAdapterCommand()` for safe IPC
- **Factory/Accessor**: `createAdapterCommand()`, `getAdapterCommandProperty()` for safe construction and access
- **Logging**: `logAdapterCommandValidation()` for structured debugging output

## Internal Organization and Data Flow
Tests follow a layered validation approach:
1. **Input validation**: Type guards at entry points (IPC, deserialization)
2. **Processing safety**: Factory functions with validated construction
3. **Output validation**: Serialization with pre-validation checks
4. **Error handling**: Structured error messages with context and recovery

The session migration tests ensure backward compatibility is properly removed while the type guard tests ensure forward compatibility through runtime validation.

## Important Patterns and Conventions
- **Environment isolation**: Tests clean up environment variables to avoid side effects
- **Console spy patterns**: Systematic setup/teardown of console mocking for logging validation
- **Type narrowing verification**: Tests confirm TypeScript compiler type safety
- **Performance benchmarking**: Large dataset validation to ensure scalability
- **Round-trip consistency**: Serialization/deserialization integrity validation
- **Error message validation**: Detailed error content and structure verification
- **Source context preservation**: Error messages include source information for debugging

## Testing Strategy
The directory demonstrates comprehensive testing patterns:
- **API migration verification** through compilation and runtime checks
- **Boundary validation** for all external data entry points
- **Error path coverage** including edge cases and malformed input
- **Performance validation** for production-scale data volumes
- **Integration testing** across related components (session store, type guards, serialization)