# tests/core/unit/utils/
@generated: 2026-02-10T01:19:40Z

## Purpose
This directory contains unit tests for critical utility functions in the core system, focusing on session management and runtime type safety. It validates API migration completeness and ensures robust data validation at system boundaries.

## Key Components

### Session Migration Testing (`session-migration.test.ts`)
- **API Evolution Validation**: Ensures complete migration from deprecated `pythonPath` to `executablePath` parameter
- **Multi-Language Support**: Tests session creation across all supported debug languages (Python, Mock)
- **Platform Compatibility**: Validates executable path defaults and platform-specific behavior
- **Type Safety**: Confirms TypeScript prevents usage of deprecated API surface

### Type Guard Testing (`type-guards.test.ts`)
- **Runtime Type Safety**: Validates type guards for AdapterCommand and ProxyInitPayload structures
- **Boundary Protection**: Tests data validation at critical IPC and serialization boundaries
- **Error Handling**: Ensures detailed error reporting with source context for debugging
- **Serialization Safety**: Validates JSON round-trip consistency and circular reference handling

## Public API Surface
The tests validate these core utilities:
- **Session Management**: SessionStore, CreateSessionParams interfaces
- **Type Guards**: `isValidAdapterCommand`, `validateAdapterCommand`, `hasValidAdapterCommand`, `validateProxyInitPayload`
- **Data Operations**: `serializeAdapterCommand`, `deserializeAdapterCommand`, `createAdapterCommand`
- **Safe Accessors**: `getAdapterCommandProperty`, `logAdapterCommandValidation`

## Internal Organization
```
Session Layer (Migration Testing)
├── API compatibility validation
├── Platform-specific defaults
└── Multi-language support

Type Safety Layer (Guard Testing)  
├── Runtime validation functions
├── Serialization/deserialization
├── Factory and accessor utilities
└── Structured error reporting
```

## Data Flow Patterns
1. **Session Creation**: Parameters flow through validation → platform defaults → SessionStore
2. **Command Processing**: Raw data → type guards → validated structures → safe operations
3. **Error Handling**: Validation failures → detailed error objects → logging with context
4. **Serialization**: Objects → pre-validation → JSON → post-validation → objects

## Key Testing Patterns
- **Migration Safety**: TypeScript compilation validation prevents deprecated API usage
- **Boundary Testing**: Null/undefined/primitive rejection at all validation points
- **Performance Validation**: Large dataset handling for production scenarios
- **Console Spy Integration**: Structured logging verification with timestamp consistency
- **Round-trip Testing**: Serialization consistency across complex data structures

## Dependencies
- **Core Session Module**: SessionStore and parameter interfaces
- **Shared Types**: DebugLanguage enum, AdapterCommand, ProxyInitPayload
- **Testing Framework**: Vitest with mocking capabilities for isolated testing
- **Platform APIs**: Environment variable handling, platform detection

This test suite ensures the utility layer maintains data integrity, API compatibility, and runtime safety across the entire debug session lifecycle.