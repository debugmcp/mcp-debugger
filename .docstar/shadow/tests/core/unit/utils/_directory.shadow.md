# tests/core/unit/utils/
@generated: 2026-02-09T18:16:11Z

## Overall Purpose
This directory contains comprehensive unit tests for critical utility functions in the DebugMCP core system, focusing on two key areas: **session parameter migration** and **runtime type safety validation**. These tests ensure system reliability at critical boundaries including session creation, IPC communication, and data serialization.

## Key Components and Relationships

### Session Migration Testing (`session-migration.test.ts`)
- **Purpose**: Validates migration from deprecated `pythonPath` to new `executablePath` parameter
- **Scope**: Tests TypeScript type safety, parameter validation, and backward compatibility
- **Coverage**: 6 test scenarios covering rejection of old parameters, multi-language support, platform-specific defaults, and API completeness

### Type Guard Testing (`type-guards.test.ts`)
- **Purpose**: Comprehensive validation of 9 type guard and validation utilities
- **Scope**: 150+ test cases covering edge cases, error handling, and performance
- **Coverage**: Tests `AdapterCommand` validation, `ProxyInitPayload` validation, serialization/deserialization, and structured logging

## Public API Testing Surface

### Session Management APIs
- **CreateSessionParams validation**: Ensures only `executablePath` parameter accepted
- **SessionStore integration**: Tests session creation and retrieval workflows
- **Multi-language support**: Validates Python and Mock language session creation
- **Platform defaults**: Tests executable path resolution (python3 on Unix, python on Windows)

### Type Safety APIs
- **Primary type guards**: `isValidAdapterCommand`, `hasValidAdapterCommand`
- **Validation functions**: `validateAdapterCommand`, `validateProxyInitPayload`
- **Serialization utilities**: `serializeAdapterCommand`, `deserializeAdapterCommand`
- **Factory functions**: `createAdapterCommand`
- **Safe accessors**: `getAdapterCommandProperty`
- **Logging utilities**: `logAdapterCommandValidation`

## Internal Organization and Data Flow

### Test Architecture Patterns
- **Console spy pattern**: Captures validation logging for verification
- **Error context validation**: Ensures detailed error messages with source tracking
- **Type narrowing verification**: Confirms TypeScript type guards work correctly
- **Performance testing**: Validates scalability with large inputs

### Data Validation Flow
1. **Input validation** → Type guards check structure and types
2. **Error handling** → Detailed error messages with source context
3. **Serialization safety** → JSON conversion with circular reference protection
4. **Logging integration** → Structured validation logs with timestamps

## Important Patterns and Conventions

### Testing Standards
- **Comprehensive edge case coverage**: null/undefined, primitives, malformed data, prototype pollution
- **Error message validation**: Detailed content verification and source tracking
- **Round-trip integrity**: Serialization/deserialization consistency testing
- **Performance constraints**: Large array handling with timing requirements

### Migration Safety
- **TypeScript enforcement**: Compiler-level prevention of deprecated parameter usage
- **Backward compatibility**: Maintains existing functionality while enforcing new interfaces
- **Platform awareness**: Handles OS-specific executable path defaults

### Runtime Type Safety
- **IPC communication boundaries**: Validates data at process boundaries
- **Serialization integrity**: Ensures safe JSON conversion for inter-process communication
- **Structured logging**: JSON-formatted validation logs for debugging and monitoring

## Dependencies and Integration
- **Core modules**: SessionStore, DebugLanguage, type-guards utilities
- **Testing framework**: Vitest with comprehensive mocking capabilities
- **Shared types**: AdapterCommand, ProxyInitPayload from @debugmcp/shared
- **Platform integration**: Environment variable manipulation and OS detection

This test suite serves as the quality gate for critical system utilities, ensuring type safety, parameter migration compliance, and robust error handling across the DebugMCP platform.