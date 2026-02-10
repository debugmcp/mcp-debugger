# tests/unit/test-utils/mock-validation.test.ts
@source-hash: ef52daf00da5ac46
@generated: 2026-02-10T00:41:39Z

## Purpose
Test suite for automated mock generation and validation utilities, ensuring mock objects correctly implement class interfaces for reliable testing.

## Key Test Classes
- **TestClass (L15-50)**: Primary test fixture with public/private methods, properties, getters/setters, async methods, and boolean methods
- **ExtendedClass (L52-56)**: Inherits from TestClass to test inheritance handling
- **TestEventEmitter (L58-66)**: EventEmitter subclass for testing event-based mocking
- **ProxyManagerLike (L304-324)**: Integration test class simulating real-world EventEmitter-based service

## Dependencies
- **vitest**: Testing framework with describe/it/expect/vi utilities (L5)
- **auto-mock.js**: Core mock generation utilities being tested (L6-11)
- **events**: Node.js EventEmitter for event-based testing (L12)

## Test Structure

### createMockFromInterface Tests (L69-139)
Tests automatic mock generation with various configuration options:
- Basic mock creation with vi.fn() spies (L70-77)
- Smart defaults for boolean methods (false) and object methods (undefined) (L79-90)
- Method exclusion by regex patterns or name arrays (L92-108) 
- Custom return value configuration (L110-120)
- Inheritance handling with includeInherited option (L122-138)

### validateMockInterface Tests (L141-239)
Tests mock validation against class interfaces:
- Complete mock validation success (L142-158)
- Missing public method detection with errors (L160-171)
- Private method warnings without failures (L173-195)
- Type validation for mock methods (L197-213)
- Extra member detection with warnings (L215-238)

### createValidatedMock Tests (L241-260)
Tests combined mock creation and validation:
- One-step creation with automatic validation (L242-249)
- Options application with validation preservation (L251-259)

### createEventEmitterMock Tests (L262-299)
Tests EventEmitter-specific mocking:
- Standard EventEmitter method mocking (on, emit, etc.) (L263-275)
- Custom method merging for EventEmitter subclasses (L277-286)
- Integration with validateMockInterface (L288-298)

### Integration Tests (L301-343)
Real-world usage simulation with ProxyManagerLike class demonstrating complete workflow from mock creation to validation.

## Testing Patterns
- Console spy mocking for warning verification
- Promise-based async method testing
- Type checking validation (vi.isMockFunction)
- Error message pattern matching
- Method chaining validation for EventEmitter

## Key Validation Rules
- Public methods must exist and be functions
- Private methods generate warnings if missing but don't fail validation
- Extra mock members generate warnings
- Boolean methods default to false
- Object methods default to undefined
- Method exclusion supports both regex and string array patterns