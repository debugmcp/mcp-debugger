# packages/adapter-java/tests/unit/
@generated: 2026-02-10T21:26:17Z

## Java Adapter Unit Test Suite

This directory contains comprehensive unit tests for the Java debug adapter implementation, validating the complete integration and functionality of Java debugging capabilities within the MCP debug framework.

### Overall Purpose

Provides thorough test coverage for the Java debug adapter's core components: adapter factory instantiation, Java environment detection and validation, and Java Debugger (JDB) output parsing. These tests ensure reliable Java debugging support across different Java versions and system configurations.

### Key Components

**JavaAdapterFactory Tests (`java-adapter-factory.test.ts`)**
- Tests adapter creation and metadata retrieval
- Validates Java environment compatibility (Java 8+ requirement)
- Comprehensive validation testing for missing dependencies and version incompatibilities
- Mock-based dependency injection testing

**Java Utilities Tests (`java-utils.test.ts`)**
- Tests Java version detection and parsing across legacy (1.x) and modern (9+) formats
- Validates JAVA_HOME environment discovery
- Tests subprocess execution for Java command validation
- Command finder abstraction testing with pluggable discovery mechanisms

**JDB Parser Tests (`jdb-parser.test.ts`)**
- Comprehensive testing of Java Debugger output parsing
- Validates parsing of debugging events, stack traces, variables, and thread states
- Tests breakpoint management and error handling
- VM lifecycle state detection testing

### Integration Patterns

The test suite follows a layered testing approach:

1. **Environment Layer**: Java utilities ensure proper Java installation detection
2. **Factory Layer**: Adapter factory validates environment and creates debug instances
3. **Parser Layer**: JDB parser handles runtime debugging communication

All components use extensive mocking to isolate functionality and provide hermetic test execution, with shared patterns for dependency injection and error simulation.

### Test Architecture

**Common Patterns**:
- Comprehensive mock setup with typed references for assertions
- AAA (Arrange-Act-Assert) pattern throughout
- Edge case coverage including malformed inputs and missing dependencies
- Environment manipulation with proper cleanup for test isolation

**Mock Strategy**:
- Child process mocking for subprocess testing
- File system mocking for environment detection
- Event emitter simulation for async process behavior
- Custom test implementations of interfaces for dependency injection

### Public API Coverage

Tests validate the complete public interface of the Java adapter:
- `JavaAdapterFactory.createAdapter()` - Adapter instantiation
- `JavaAdapterFactory.getMetadata()` - Adapter information retrieval
- `JavaAdapterFactory.validateEnvironment()` - Environment compatibility checking
- Java utility functions for version detection and environment discovery
- JDB parser methods for all debugging protocol operations

The test suite ensures robust error handling, version compatibility, and proper integration with the broader MCP debug framework.