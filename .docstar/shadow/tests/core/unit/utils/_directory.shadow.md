# tests\core\unit\utils/
@generated: 2026-02-12T21:05:43Z

## Overview
This directory contains unit tests for core utility modules in the debugging system, focusing on session migration validation and type safety enforcement. The tests ensure API transitions are handled correctly and runtime data validation works reliably at critical system boundaries.

## Key Components

### Session Migration Testing (`session-migration.test.ts`)
Validates the complete migration from deprecated `pythonPath` to `executablePath` parameters across the session management API. This test suite ensures:
- **API Migration Completeness**: Verifies old parameters are rejected and new parameters work consistently
- **Multi-language Support**: Tests that `executablePath` works correctly for Python, Mock, and other debug languages
- **Platform Compatibility**: Validates executable path defaults across different operating systems
- **Type Safety**: Ensures TypeScript compilation prevents usage of deprecated parameters

### Type Guard Testing (`type-guards.test.ts`)
Comprehensive validation of runtime type safety utilities that protect data integrity at IPC and serialization boundaries. This suite covers:
- **AdapterCommand Validation**: Runtime type checking for command structures with performance benchmarks
- **ProxyInitPayload Validation**: Complete payload validation including required/optional fields
- **Serialization Safety**: JSON serialization/deserialization with validation hooks
- **Factory Functions**: Safe object creation with input validation
- **Error Handling**: Structured error reporting with source context

## Data Flow & Integration
The utilities tested here form a critical validation layer:
1. **Session Creation** → Migration tests ensure new `executablePath` parameter works across all session creation paths
2. **IPC Communication** → Type guards validate command structures before/after network transmission
3. **Serialization Boundaries** → Validation functions ensure data integrity during JSON operations
4. **Factory Creation** → Safe object construction with validation built-in

## Testing Patterns
Both test suites follow consistent patterns:
- **Boundary Testing**: Valid/invalid input validation with edge cases
- **Type System Integration**: TypeScript compilation verification alongside runtime checks
- **Performance Validation**: Benchmarks for validation functions handling large datasets
- **Error Message Validation**: Structured error reporting with detailed context
- **Console Output Testing**: Logging behavior verification with mock spies

## Public API Coverage
Tests validate the complete public interface of utility functions:
- `isValidAdapterCommand()` - Runtime type guard
- `validateAdapterCommand()` - Throwing validation function  
- `validateProxyInitPayload()` - Complete payload validation
- `serializeAdapterCommand()` / `deserializeAdapterCommand()` - Safe serialization
- `createAdapterCommand()` - Factory with validation
- `getAdapterCommandProperty()` - Safe property access
- Session creation with `executablePath` parameter

## Critical System Role
These tests protect the system's data integrity at two crucial points:
1. **API Evolution**: Ensuring smooth migration from old to new parameter names without breaking changes
2. **Runtime Safety**: Validating data structures at boundaries where type information is lost (IPC, serialization)

The combination ensures both compile-time type safety through TypeScript and runtime protection through validated type guards, forming a comprehensive safety net for the debugging system's core operations.