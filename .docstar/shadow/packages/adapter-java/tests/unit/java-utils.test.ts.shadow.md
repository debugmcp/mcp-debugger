# packages/adapter-java/tests/unit/java-utils.test.ts
@source-hash: 99a9ab21b21f040a
@generated: 2026-02-09T18:13:59Z

## Purpose
Unit test suite for Java utility functions in the Java adapter package. Tests Java version parsing, executable detection, environment handling, and command finding mechanisms.

## Test Structure

### parseJavaMajorVersion Tests (L34-52)
- **Old Format Parsing (L35-39)**: Tests legacy Java 1.x version format extraction (1.8.0_392 → 8)
- **New Format Parsing (L41-45)**: Tests modern Java 9+ version format extraction (17.0.1 → 17)  
- **Invalid Input Handling (L47-51)**: Verifies graceful handling of malformed version strings (returns 0)

### getJavaVersion Tests (L54-133)
- **simulateSpawn Helper (L55-74)**: Mock factory for child process behavior with configurable output/exit codes
- **Version Extraction Tests (L76-92)**: Validates parsing from actual `java -version` stderr output across formats
- **Error Handling (L94-111)**: Tests spawn failures and non-zero exit codes (returns null)
- **Timeout Test (L113-132)**: Skipped test for hanging process scenarios

### findJavaHome Tests (L135-167)
- **Environment Setup (L136-144)**: Preserves and restores process.env for isolation
- **JAVA_HOME Detection (L146-160)**: Tests environment variable validation with filesystem checks
- **Missing JAVA_HOME (L162-166)**: Verifies null return when environment variable absent

### CommandNotFoundError Tests (L169-176)
- **Error Properties (L170-175)**: Validates custom error class with command property

### CommandFinder Tests (L178-194)
- **MockCommandFinder (L179-183)**: Test implementation returning mock paths
- **Custom Finder Registration (L185-193)**: Tests setDefaultCommandFinder with proper cleanup

## Dependencies
- **vitest**: Testing framework with mocking capabilities
- **child_process.spawn**: Mocked for process execution simulation
- **which**: Mocked for command path resolution
- **node:fs**: Mocked for filesystem operations

## Mock Strategy
- **Partial Mock Pattern (L14-20)**: Preserves actual child_process exports while mocking spawn
- **EventEmitter Simulation (L57-72)**: Complex mock recreating Node.js child process behavior
- **Environment Isolation (L138-144)**: Ensures test independence via env restoration

## Testing Patterns
- Uses queueMicrotask for asynchronous event simulation
- Implements proper mock cleanup in beforeEach/afterEach hooks
- Employs type assertions for complex mock objects
- Tests both success and failure paths comprehensively