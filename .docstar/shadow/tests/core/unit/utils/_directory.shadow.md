# tests\core\unit\utils/
@generated: 2026-02-12T21:00:56Z

## Purpose

This directory contains unit tests for core utility modules in the debug system, focusing on two critical areas: session management migration and runtime type safety validation. The tests ensure system stability during API transitions and validate data integrity at system boundaries.

## Key Components

### Session Migration Testing (`session-migration.test.ts`)
Comprehensive test suite validating the migration from legacy `pythonPath` to standardized `executablePath` parameter across all session management interfaces. Tests cover:
- API migration completeness verification
- Multi-language support (Python, Mock) with new parameter structure
- Platform-specific executable defaults and environment handling
- Type safety enforcement preventing use of deprecated parameters

### Type Guard Testing (`type-guards.test.ts`)
Extensive validation of runtime type safety utilities that protect critical system boundaries (IPC, serialization). Tests cover:
- `AdapterCommand` structure validation with comprehensive edge case handling
- `ProxyInitPayload` validation for session initialization data
- Serialization/deserialization safety with error handling
- Factory functions and property accessors with fallback mechanisms
- Structured logging utilities for validation events

## System Integration

These test modules work together to ensure:

**Data Flow Safety**: Type guards validate data structures before they flow between system components, while session tests ensure proper parameter handling during session lifecycle management.

**API Evolution Support**: Session migration tests verify backward compatibility is properly broken (old API rejected) while new API works consistently across all supported languages and platforms.

**Boundary Protection**: Both modules focus on testing critical boundaries - session creation/management and data validation at serialization points.

## Public API Coverage

The tests validate these key entry points:
- `SessionStore` creation and parameter validation
- `CreateSessionParams`, `ProxyConfig`, and `ProxyInitPayload` interfaces
- Type guard functions: `isValidAdapterCommand`, `validateAdapterCommand`, `hasValidAdapterCommand`, `validateProxyInitPayload`
- Serialization utilities: `serializeAdapterCommand`, `deserializeAdapterCommand`
- Factory and utility functions: `createAdapterCommand`, `getAdapterCommandProperty`, `logAdapterCommandValidation`

## Testing Patterns

Both test suites follow consistent patterns:
- **Environment isolation**: Cleanup of environment variables and console mocks
- **Comprehensive edge case coverage**: Including null/undefined, prototype pollution, circular references
- **Performance validation**: Ensuring type guards perform well with large datasets
- **Error message validation**: Verifying detailed, actionable error reporting
- **Type safety verification**: Using TypeScript compiler behavior to validate type narrowing

## Dependencies

- **vitest** framework with mocking capabilities for console and timer control
- **@debugmcp/shared** package for shared types and enums
- Core session management modules (`SessionStore`, parameter types)
- Platform-specific utilities for executable path resolution

This test directory ensures the stability and reliability of the debug system's core utilities through comprehensive validation of both API evolution and runtime type safety mechanisms.