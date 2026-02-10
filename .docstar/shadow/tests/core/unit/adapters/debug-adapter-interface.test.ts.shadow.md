# tests/core/unit/adapters/debug-adapter-interface.test.ts
@source-hash: 2b0fb6075a0819cf
@generated: 2026-02-10T00:41:24Z

**Purpose**: Comprehensive unit test suite for the debug-adapter-interface module, validating enums, error classes, and type interfaces from the @debugmcp/shared package.

**Key Test Suites**:

- **AdapterState enum validation (L26-41)**: Tests the 7 adapter lifecycle states (uninitialized → ready → debugging → error)
- **AdapterErrorCode enum validation (L43-76)**: Validates 13 error codes across categories:
  - Environment errors: EXECUTABLE_NOT_FOUND, ADAPTER_NOT_INSTALLED (L44-49)  
  - Connection errors: CONNECTION_FAILED, CONNECTION_TIMEOUT (L51-55)
  - Protocol errors: INVALID_RESPONSE, UNSUPPORTED_OPERATION (L57-60)
  - Runtime errors: DEBUGGER_ERROR, SCRIPT_NOT_FOUND (L62-66)
- **DebugFeature enum validation (L78-106)**: Tests 20 debug protocol features like conditional breakpoints, variable inspection, step debugging
- **AdapterError class testing (L108-141)**: Validates custom error class with code categorization and recovery flags

**Type Interface Testing (L143-485)**:
- **ValidationResult (L144-191)**: Tests validation state with errors/warnings collections
- **DependencyInfo (L193-217)**: Tests dependency metadata with version requirements
- **AdapterCommand (L219-245)**: Tests command execution configuration with environment variables
- **AdapterConfig (L247-286)**: Tests complete adapter configuration including session, paths, and launch settings
- **GenericLaunchConfig (L288-314)**: Tests base launch configuration options
- **LanguageSpecificLaunchConfig (L316-330)**: Tests extension of generic config with language-specific options
- **FeatureRequirement (L333-367)**: Tests requirement categorization (dependency/version/configuration)
- **AdapterCapabilities (L369-456)**: Tests extensive capability flags for debug protocol features
- **ExceptionBreakpointFilter (L458-484)**: Tests exception filtering configuration

**Error Handling Patterns (L487-514)**: Tests error categorization and recovery strategies with different error types and recovery flags.

**Type Safety Validation (L516-531)**: Ensures enum values are properly constrained and type-safe.

**Dependencies**: 
- vitest testing framework
- @debugmcp/shared package providing all tested types and enums
- Validates 40+ interface properties and enum values

**Testing Architecture**: Uses describe/it structure for organized validation of enums, classes, and complex type interfaces with both positive and negative test cases.