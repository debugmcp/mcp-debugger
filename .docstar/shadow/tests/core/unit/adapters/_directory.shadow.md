# tests\core\unit\adapters/
@generated: 2026-02-12T21:00:56Z

## Purpose and Responsibility

The `tests/core/unit/adapters` directory contains comprehensive unit test suites that validate the core adapter interface contracts and type definitions used throughout the DebugMCP system. This testing module ensures the integrity and type safety of the foundational debug adapter protocol interfaces, enums, and error handling mechanisms defined in the `@debugmcp/shared` package.

## Key Components and Architecture

### Test Organization
The directory follows a focused testing approach with a single comprehensive test file:

- **debug-adapter-interface.test.ts**: Master test suite validating all adapter interface components including enums, error classes, and complex type interfaces

### Validated Components
The test suite covers four primary areas:

1. **Enum Validation**: Tests 40+ enum values across three critical enums:
   - `AdapterState`: 7 lifecycle states (uninitialized → ready → debugging → error)
   - `AdapterErrorCode`: 13 categorized error codes spanning environment, connection, protocol, and runtime errors
   - `DebugFeature`: 20 debug protocol capability flags

2. **Error Class Testing**: Validates the `AdapterError` custom error class with proper code categorization and recovery flag handling

3. **Type Interface Validation**: Comprehensive testing of 9 complex interfaces covering configuration, capabilities, validation results, and dependency management

4. **Error Handling Patterns**: Tests systematic error categorization and recovery strategies

## Public API Surface

### Primary Test Entry Points
- **Enum validation suites**: Ensure consistent state management and error categorization
- **Type interface tests**: Validate configuration contracts and capability definitions
- **Error handling tests**: Verify proper error classification and recovery mechanisms

### Key Validated Interfaces
- `AdapterConfig`: Complete adapter configuration including session, paths, and launch settings
- `AdapterCapabilities`: Extensive capability flags for debug protocol features
- `ValidationResult`: Validation state management with error/warning collections
- `FeatureRequirement`: Requirement categorization for dependencies and versions

## Internal Organization and Data Flow

### Testing Strategy
The module employs a layered testing approach:
1. **Foundation Layer**: Enum value validation ensuring consistent constants
2. **Error Layer**: Custom error class testing with proper inheritance and categorization
3. **Interface Layer**: Complex type validation with nested properties and relationships
4. **Integration Layer**: Error handling pattern validation across different scenarios

### Test Architecture
- Uses vitest framework for structured describe/it test organization
- Implements both positive and negative test cases for comprehensive coverage
- Validates type safety and enum constraint enforcement
- Tests 40+ interface properties and enum values systematically

## Important Patterns and Conventions

### Type Safety Enforcement
- All enum values are tested for proper type constraints
- Interface properties are validated for correct types and required/optional status
- Error codes are systematically categorized and tested for proper inheritance

### Error Handling Standardization
- Consistent error categorization across environment, connection, protocol, and runtime domains
- Recovery flag patterns for different error types
- Proper error class inheritance and custom properties

### Configuration Management
- Standardized configuration interfaces with clear separation between generic and language-specific options
- Capability flag patterns for feature detection and negotiation
- Dependency management with version requirement validation

This testing directory serves as the quality gate for the adapter interface contracts, ensuring that all components consuming these interfaces can rely on consistent, well-defined types and error handling patterns throughout the DebugMCP system.