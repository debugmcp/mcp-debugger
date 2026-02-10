# packages/adapter-java/tests/unit/java-utils.test.ts
@source-hash: 86bbe63a3df90ba6
@generated: 2026-02-10T01:19:01Z

## Purpose
Unit test suite for Java utility functions in the adapter-java package. Tests Java version parsing, detection, and environment discovery capabilities.

## Test Structure

### Core Test Modules
- **parseJavaMajorVersion tests (L34-52)**: Validates parsing of both legacy (1.x) and modern (9+) Java version formats, plus error handling for invalid inputs
- **getJavaVersion tests (L54-135)**: Tests subprocess execution to retrieve Java version strings, including timeout and error scenarios
- **findJavaHome tests (L137-162)**: Verifies JAVA_HOME environment variable detection and validation
- **CommandNotFoundError tests (L164-171)**: Tests custom error class for missing Java commands
- **CommandFinder tests (L173-189)**: Tests pluggable command discovery mechanism

### Key Testing Utilities
- **simulateSpawn helper (L55-74)**: Mocks child_process.spawn with configurable output and exit codes, using EventEmitter to simulate async process behavior
- **MockCommandFinder class (L174-178)**: Test implementation of CommandFinder interface for dependency injection testing

## Dependencies & Mocking
- **Vitest framework**: Core testing utilities imported at L1-2
- **child_process mock (L14-20)**: Intercepts spawn calls for subprocess testing
- **which mock (L22-24)**: Mocks command path resolution
- **Environment isolation (L138-146)**: Preserves and restores process.env for hermetic testing

## Test Patterns
- Comprehensive version format coverage: old format (1.8.x), new format (9+), and edge cases
- Error simulation: spawn failures, non-zero exits, and malformed outputs
- Environment manipulation: JAVA_HOME presence/absence testing
- Dependency injection: Custom CommandFinder implementation testing

## Notable Implementation Details
- **Async process simulation**: Uses queueMicrotask for proper event loop scheduling in mocks
- **Timeout test skipped (L115)**: Acknowledged flaky behavior with fake timers in CI environments
- **Flexible assertion pattern (L154)**: Accepts multiple valid outcomes where fs mocking limitations exist