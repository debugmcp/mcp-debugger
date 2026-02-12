# tests/core/unit/utils/
@generated: 2026-02-11T23:47:37Z

## Purpose
Unit test directory for core utility functions providing runtime type safety, data validation, and API migration verification for the debugmcp system. Tests critical boundary validation for IPC communication, serialization/deserialization, and session management parameter evolution.

## Key Components

### Session Migration Tests (`session-migration.test.ts`)
- **Migration Verification**: Validates complete migration from deprecated `pythonPath` to `executablePath` parameter across all session APIs
- **Multi-language Support**: Tests executable path handling for Python and Mock debug languages
- **Platform Defaults**: Validates environment-specific executable defaults (python vs python3)
- **API Completeness**: Documents that all interfaces (CreateSessionParams, ProxyConfig, ProxyInitPayload) use the new parameter structure

### Type Guard Tests (`type-guards.test.ts`)
- **Runtime Validation**: Tests type guards for AdapterCommand and ProxyInitPayload structures at IPC boundaries
- **Serialization Safety**: Validates JSON serialization/deserialization with pre/post validation
- **Factory Functions**: Tests safe construction utilities with default handling
- **Error Handling**: Validates detailed error messaging with source context for debugging

## Public API Coverage
The tests validate these key utility functions:
- **`isValidAdapterCommand`**: Runtime type guard with TypeScript narrowing
- **`validateAdapterCommand`**: Throwing validator with detailed error context
- **`hasValidAdapterCommand`**: ProxyInitPayload.adapterCommand validation
- **`validateProxyInitPayload`**: Complete payload validation for IPC
- **`serializeAdapterCommand`/`deserializeAdapterCommand`**: Safe JSON handling
- **`createAdapterCommand`**: Factory with defaults
- **`getAdapterCommandProperty`**: Safe property access with fallback
- **`logAdapterCommandValidation`**: Structured logging utility

## Internal Organization

### Test Patterns
- **Boundary Testing**: Validates data at critical system interfaces (IPC, serialization)
- **Migration Testing**: Ensures API evolution maintains backward compatibility while enforcing new patterns
- **Performance Testing**: Large dataset validation to ensure type guards scale appropriately
- **Error Context**: Comprehensive error message validation for developer experience

### Data Flow Validation
1. **Input Validation**: Type guards ensure data structure integrity at entry points
2. **Transformation Safety**: Serialization tests ensure data survives round-trip processing
3. **Output Validation**: Factory functions guarantee valid output structures
4. **Error Propagation**: Validation failures include source context and detailed diagnostics

## Important Conventions
- **Console Spy Management**: Consistent setup/teardown for logging validation
- **Environment Isolation**: Try/finally blocks for environment variable cleanup
- **Type Narrowing**: Verification that TypeScript compiler correctly narrows types after validation
- **Performance Benchmarks**: Large dataset testing to ensure validation doesn't become a bottleneck
- **Round-trip Testing**: Serialization consistency verification

## Integration Points
These utilities support:
- **Session Management**: Parameter migration and validation for session creation
- **IPC Communication**: AdapterCommand validation between proxy and adapter processes  
- **Debugging Infrastructure**: Type-safe communication with language-specific debug adapters
- **Error Diagnostics**: Structured logging and error reporting for system monitoring