# packages/adapter-mock/tests/unit/mock-adapter-factory.test.ts
@source-hash: 80bbaaacb041fb51
@generated: 2026-02-09T18:14:04Z

## Purpose
Unit test suite for MockAdapterFactory, validating factory pattern implementation for creating mock debug adapters in a debugger testing framework.

## Key Test Structure

**createDependencies helper (L7-22)**: Factory function that creates mock AdapterDependencies with stub implementations for fileSystem, processLauncher, environment, and logger. Returns test-friendly dependencies with no-op logger methods.

**Main test suite (L24-86)**: Comprehensive validation of MockAdapterFactory functionality across five test scenarios:

### Core Factory Tests
- **Instance creation test (L25-35)**: Verifies factory creates MockDebugAdapter instances with correct feature support configuration
- **Metadata validation test (L37-47)**: Validates factory exposes accurate adapter metadata including language, display name, version, and file extensions
- **Default validation test (L49-56)**: Confirms factory validates successfully with empty configuration

### Configuration Warning Tests  
- **Error probability warning test (L58-65)**: Validates factory reports warnings when errorProbability exceeds 70%
- **Delay warning test (L67-74)**: Validates factory reports warnings when defaultDelay exceeds 2000ms

### Helper Function Test
- **createMockAdapterFactory test (L76-85)**: Verifies the convenience function properly forwards configuration to MockAdapterFactory constructor

## Dependencies
- **vitest**: Testing framework providing describe/it/expect
- **@debugmcp/shared**: Core types (AdapterDependencies, DebugFeature, DebugLanguage)
- **MockAdapterFactory/createMockAdapterFactory**: Factory classes under test
- **MockDebugAdapter**: Expected adapter instance type

## Test Patterns
- Uses dependency injection pattern with mock dependencies
- Validates both positive paths (successful creation) and warning conditions
- Tests both class constructor and convenience function approaches
- Focuses on factory contract compliance rather than adapter implementation details