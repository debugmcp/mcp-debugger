# tests/core/unit/utils/type-guards.test.ts
@source-hash: b2c71879f89f765f
@generated: 2026-02-09T18:14:39Z

## Primary Purpose
Comprehensive unit test suite for type guard and validation utilities, ensuring runtime type safety at critical boundaries like IPC communication and data serialization. Tests 9 validation functions with 150+ test cases covering edge cases, error handling, and performance characteristics.

## Test Structure
- **Main describe block** (L20-677): "Type Guards" with console spy setup (L25-33) and teardown (L31-33)
- **beforeEach/afterEach hooks** (L25-33): Mock console methods (error, log, warn) to capture validation logging

## Core Functions Under Test

### isValidAdapterCommand Tests (L35-192)
Tests the primary type guard function with comprehensive validation:
- **Valid commands** (L36-75): Basic validation, optional fields, TypeScript type narrowing verification
- **Invalid inputs** (L77-138): null/undefined, primitive types, missing/invalid fields, malformed args/env
- **Edge cases** (L140-191): Symbol properties, prototype pollution, deep nesting, performance with large arrays

### validateAdapterCommand Tests (L194-254)
Tests validation function that throws on invalid input:
- **Success cases** (L195-204): Returns valid commands unchanged
- **Error handling** (L206-253): Detailed error messages with source context, special character handling

### hasValidAdapterCommand Tests (L256-303)
Tests ProxyInitPayload validation:
- **Optional field handling** (L257-268): Payloads without adapterCommand
- **Nested validation** (L271-302): Valid and invalid nested adapterCommand objects

### validateProxyInitPayload Tests (L305-372)
Tests comprehensive payload validation:
- **Required fields** (L332-343): All 7 required fields (cmd, sessionId, executablePath, etc.)
- **Type validation** (L321-330): Non-object input handling
- **Nested command validation** (L345-371): AdapterCommand integration with error logging

### Serialization Tests (L374-436)
**serializeAdapterCommand** tests JSON serialization:
- **Basic serialization** (L375-386): Valid command to JSON conversion
- **Validation integration** (L388-393): Pre-serialization validation
- **Error cases** (L414-435): Circular references, BigInt handling

### Deserialization Tests (L438-486)
**deserializeAdapterCommand** tests JSON parsing:
- **Round-trip integrity** (L474-485): Serialize/deserialize consistency
- **Error handling** (L450-472): Invalid JSON, malformed structures
- **Source tracking** (L462-465): Error message context preservation

### Factory Function Tests (L488-541)
**createAdapterCommand** tests object creation:
- **Parameter handling** (L489-517): Command, args, env combinations
- **Input validation** (L519-526): Invalid command rejection
- **Output validation** (L533-540): Created objects pass type guards

### Property Access Tests (L543-581)
**getAdapterCommandProperty** tests safe property access:
- **Valid access** (L550-554): Property retrieval from valid commands
- **Fallback behavior** (L556-580): Default values for invalid inputs with warning logs

### Logging Tests (L583-676)
**logAdapterCommandValidation** tests structured logging:
- **Timestamp mocking** (L585-592): Consistent test timestamps using fake timers
- **Output formatting** (L594-651): console.log vs console.error, JSON indentation
- **Complex data handling** (L653-675): Nested objects, detailed error structures

## Key Dependencies
- **vitest**: Test framework with mocking capabilities (L5)
- **@debugmcp/shared**: AdapterCommand type definition (L17)
- **type-guards.js**: All tested validation functions (L6-16)
- **dap-proxy-interfaces.js**: ProxyInitPayload type (L18)

## Testing Patterns
- **Console spy pattern**: Mock console methods to verify logging behavior
- **Error message validation**: Detailed error content and source tracking verification
- **Performance testing**: Large array handling with timing constraints (L178-191)
- **Edge case coverage**: Symbol properties, prototype manipulation, circular references
- **Type narrowing verification**: Ensures TypeScript type guards work correctly (L64-75)

## Notable Architectural Decisions
- **Comprehensive error context**: All validation functions include source information for debugging
- **Structured logging**: JSON-formatted validation logs with timestamps and detailed metadata
- **Performance considerations**: Tests ensure validation scales with large inputs
- **Type safety boundaries**: Critical for IPC communication and serialization integrity