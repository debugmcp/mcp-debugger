# tests/unit/test-utils/mock-validation.test.ts
@source-hash: ef52daf00da5ac46
@generated: 2026-02-09T18:14:52Z

## Purpose
Test suite for automatic mock generation and validation utilities. Validates the functionality of mock creation, interface validation, and EventEmitter mock generation for TypeScript classes.

## Test Classes (L15-66)
- **TestClass (L15-50)**: Basic test class with public/private methods, properties, getters/setters, async methods, and boolean methods
- **ExtendedClass (L52-56)**: Inherits from TestClass, adds `extendedMethod()`
- **TestEventEmitter (L58-66)**: EventEmitter subclass with custom methods for testing event-based mock creation

## Core Test Suites

### createMockFromInterface Tests (L69-139)
Tests automatic mock generation from class constructors:
- **Basic mock creation (L70-77)**: Validates all public methods become mock functions
- **Boolean method defaults (L79-84)**: Ensures boolean methods return `false` by default
- **Getter method defaults (L86-90)**: Confirms getter methods return `undefined`
- **Method exclusion (L92-108)**: Tests regex and array-based method filtering
- **Default return values (L110-120)**: Validates custom return value configuration
- **Inheritance handling (L122-138)**: Tests inherited method mocking with optional inclusion control

### validateMockInterface Tests (L141-239)
Tests mock validation against original class interfaces:
- **Complete mock validation (L142-158)**: Validates fully-implemented mock passes
- **Missing method detection (L160-171)**: Ensures validation fails for incomplete mocks
- **Private method warnings (L173-195)**: Tests console warnings for missing private methods without failing
- **Type validation (L197-213)**: Ensures wrong-typed members cause validation failure
- **Extra member warnings (L215-238)**: Tests console warnings for mock members not in original class

### createValidatedMock Tests (L241-260)
Tests combined mock creation and validation:
- **One-step creation (L242-249)**: Validates automatic creation and validation
- **Options application (L251-259)**: Ensures options work with validation

### createEventEmitterMock Tests (L262-299)
Tests EventEmitter-specific mock creation:
- **Basic EventEmitter mocking (L263-275)**: Validates all standard EventEmitter methods
- **Method merging (L277-286)**: Tests additional method integration
- **Interface validation (L288-298)**: Ensures EventEmitter mocks pass validation

### Integration Tests (L301-343)
**ProxyManagerLike simulation (L302-342)**: Real-world test with EventEmitter-based class demonstrating complete mock creation and validation workflow

## Key Dependencies
- **vitest**: Test framework (`describe`, `it`, `expect`, `vi`, `beforeEach`)
- **./auto-mock.js**: Mock generation utilities (`createMockFromInterface`, `validateMockInterface`, `createValidatedMock`, `createEventEmitterMock`)
- **events**: Node.js EventEmitter class

## Testing Patterns
- Comprehensive validation of mock function creation using `vi.isMockFunction()`
- Console spy patterns for testing warning outputs
- Mock restoration patterns to prevent test interference
- Type-safe EventEmitter mock testing with generics