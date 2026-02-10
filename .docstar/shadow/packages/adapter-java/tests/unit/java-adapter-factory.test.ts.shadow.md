# packages/adapter-java/tests/unit/java-adapter-factory.test.ts
@source-hash: cecd2cf133a5e9f3
@generated: 2026-02-10T00:41:10Z

## Test Suite for JavaAdapterFactory

Unit tests for the `JavaAdapterFactory` class, verifying adapter creation, metadata retrieval, and environment validation capabilities.

### Core Purpose
Comprehensive test coverage for the Java debug adapter factory, ensuring proper instantiation, metadata accuracy, and robust environment validation with various Java installation scenarios.

### Key Test Structure

**Mock Setup (L13-31)**
- Mocks all Java utility functions from `java-utils.js`
- Provides simplified `parseJavaMajorVersion` implementation for testing
- Creates typed mock references for test assertions

**Dependencies Helper (L33-48)**
- `createDependencies()`: Factory function creating mock `AdapterDependencies`
- Returns minimal implementation with stubbed fileSystem, processLauncher, environment, and logger
- Environment mock returns current working directory and empty configuration

**Test Reset (L51-57)**
- `beforeEach`: Clears all mocks and resets specific utility function mocks
- Ensures test isolation between runs

### Test Categories

**Adapter Creation Tests (L59-66)**
- Verifies `JavaAdapterFactory.createAdapter()` returns `JavaDebugAdapter` instance
- Validates adapter has correct language (`DebugLanguage.JAVA`) and name properties

**Metadata Tests (L68-80)**
- Tests `getMetadata()` method returns correct adapter information
- Verifies language, display name, version, description, and file extensions (`.java`, `.class`)

**Validation Tests (L82-177)**
Extensive testing of environment validation with various scenarios:

- **Success Cases (L83-110)**: Java 17 and Java 8 compatibility validation
- **Version Failures (L112-124)**: Rejection of Java 7 (below minimum requirement)
- **Missing Dependencies (L126-148)**: Java executable not found, jdb not found
- **Tool Validation (L150-162)**: jdb executable fails internal validation
- **Edge Cases (L164-176)**: Handles undetermined Java version with warnings

### Dependencies
- **External**: `@debugmcp/shared` types and enums, Vitest testing framework
- **Internal**: `JavaAdapterFactory`, `JavaDebugAdapter`, Java utility functions
- **Mocking**: Comprehensive mocking of Java environment detection utilities

### Test Patterns
- Uses factory pattern for dependency injection
- Employs comprehensive mocking strategy for external dependencies
- Follows arrange-act-assert pattern with clear separation
- Tests both positive and negative validation scenarios
- Validates error messages and warning conditions