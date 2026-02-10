# tests/core/unit/utils/type-guards.test.ts
@source-hash: 6168cb6f31f4abb0
@generated: 2026-02-10T01:19:05Z

## Purpose
Unit test suite for type guard utilities that validate data structures at critical boundaries (IPC, serialization). Tests runtime type safety for AdapterCommand and ProxyInitPayload validation functions.

## Test Structure

**Main Test Suites:**

### isValidAdapterCommand Tests (L35-192)
Tests runtime type guard for AdapterCommand validation:
- Valid command structures (L36-62)
- TypeScript type narrowing verification (L64-75)
- Null/undefined/primitive rejection (L77-91)
- Missing/invalid field validation (L93-138)
- Edge cases: symbol properties, prototype pollution, deep nesting (L140-176)
- Performance validation for large datasets (L178-191)

### validateAdapterCommand Tests (L194-253)
Tests validation function that throws on invalid commands:
- Returns valid commands unchanged (L195-204)
- Throws with detailed error messages including source context (L206-243)
- Error structure includes receivedType, receivedValue, requiredStructure (L245-253)

### hasValidAdapterCommand Tests (L256-303)
Tests validation for ProxyInitPayload.adapterCommand property:
- Handles missing adapterCommand (optional field) (L257-269)
- Validates present adapterCommand fields (L271-302)

### validateProxyInitPayload Tests (L305-372)
Tests complete ProxyInitPayload validation:
- Required field validation: cmd, sessionId, executablePath, adapterHost, adapterPort, logDir, scriptPath (L332-343)
- Optional adapterCommand validation (L345-371)
- Type checking and error logging (L321-330)

### Serialization Tests (L374-486)
**serializeAdapterCommand (L374-436):**
- JSON serialization with pre-validation (L375-393)
- Field preservation (L395-412)
- Error handling for circular references and non-serializable types (L414-435)

**deserializeAdapterCommand (L438-486):**
- JSON parsing with post-validation (L439-472)
- Round-trip consistency (L474-485)
- Source-aware error messaging

### createAdapterCommand Tests (L488-541)
Tests factory function for AdapterCommand creation:
- Default value handling (args=[], env={}) (L489-507)
- Input validation for command parameter (L519-526)
- Output validation ensures valid AdapterCommand (L533-540)

### getAdapterCommandProperty Tests (L543-581)
Tests safe property accessor with fallback:
- Property extraction from valid commands (L550-554)
- Default fallback for invalid commands with warning logging (L556-563)
- Null/undefined input handling (L575-580)

### logAdapterCommandValidation Tests (L583-676)
Tests structured logging utility:
- Conditional logging (console.log for valid, console.error for invalid) (L594-631)
- Timestamp inclusion and JSON formatting (L633-651)
- Complex details object handling (L653-675)

## Key Dependencies
- `vitest` testing framework with mocking capabilities
- `@debugmcp/shared` for AdapterCommand type
- Console mock spies for logging validation (L21-33)
- Fake timers for consistent timestamp testing (L585-592)

## Test Patterns
- Console spy setup/teardown in beforeEach/afterEach hooks
- Type narrowing verification using TypeScript compiler
- Performance benchmarks for large data validation
- Error message content validation
- Round-trip serialization testing