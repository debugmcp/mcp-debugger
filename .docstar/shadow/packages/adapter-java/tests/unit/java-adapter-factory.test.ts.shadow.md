# packages/adapter-java/tests/unit/java-adapter-factory.test.ts
@source-hash: cecd2cf133a5e9f3
@generated: 2026-02-09T18:13:54Z

## Purpose
Unit test suite for JavaAdapterFactory class, testing adapter creation, metadata retrieval, and Java environment validation using Vitest framework.

## Key Test Structure

**Main Test Suite** (L50-178): `JavaAdapterFactory` test suite with comprehensive validation testing

**Mock Setup** (L13-31): 
- Mocks java-utils functions: `findJavaExecutable`, `getJavaVersion`, `findJdb`, `validateJdb`
- Includes inline mock implementation of `parseJavaMajorVersion` for version parsing logic
- Creates typed mock references for test manipulation

**Test Helpers** (L33-48):
- `createDependencies()`: Factory function creating mock `AdapterDependencies` with stub implementations
- Returns object with mocked `fileSystem`, `processLauncher`, `environment`, and `logger`

## Test Categories

**Adapter Creation** (L59-66): Validates factory creates JavaDebugAdapter instances with correct properties

**Metadata Testing** (L68-80): Verifies factory returns correct metadata including:
- Language type (JAVA)
- Display name, version, description 
- Supported file extensions (.java, .class)

**Validation Testing** (L82-177): Comprehensive environment validation scenarios:
- **Success cases** (L83-110): Java 17 and Java 8 compatibility
- **Version failures** (L112-124): Java 7 rejection (minimum Java 8 required)
- **Missing dependencies** (L126-148): Java executable and jdb tool not found
- **Tool validation** (L150-162): jdb tool validation failure
- **Warning cases** (L164-176): Undetermined Java version handling

## Dependencies
- Vitest testing framework with mocking capabilities
- `@debugmcp/shared` types: `AdapterDependencies`, `DebugLanguage` 
- Target classes: `JavaAdapterFactory`, `JavaDebugAdapter`
- Java utility functions from `../../src/utils/java-utils.js`

## Testing Patterns
- Uses beforeEach hook (L51-57) for comprehensive mock cleanup
- Employs mock rejection/resolution patterns for async validation testing
- Tests both positive and negative validation paths with detailed error checking
- Validates metadata consistency and adapter instantiation