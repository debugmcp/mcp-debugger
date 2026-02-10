# packages/adapter-java/tests/
@generated: 2026-02-10T21:26:34Z

## Java Adapter Test Suite

This directory contains the comprehensive test suite for the Java debug adapter implementation within the MCP debug framework. It validates all aspects of Java debugging functionality through three distinct but interconnected test modules.

### Overall Purpose and Responsibility

The test suite ensures reliable Java debugging support by validating:
- Java environment detection and compatibility checking (Java 8+ requirement)
- Debug adapter factory instantiation and lifecycle management
- Java Debugger (JDB) output parsing and protocol handling
- Integration between environment validation, adapter creation, and debugging operations

### Key Components and Integration

The test architecture follows a three-layer validation approach:

**Environment Layer (`java-utils.test.ts`)**
- Tests Java version detection across legacy (1.x) and modern (9+) version formats
- Validates JAVA_HOME environment discovery and Java command availability
- Provides subprocess execution testing with mock-based isolation
- Implements pluggable command finder abstraction for different system configurations

**Factory Layer (`java-adapter-factory.test.ts`)**  
- Tests adapter creation workflow and metadata retrieval
- Validates environment compatibility requirements before adapter instantiation
- Comprehensive error handling for missing dependencies and version incompatibilities
- Integration testing with mocked Java utilities for hermetic execution

**Parser Layer (`jdb-parser.test.ts`)**
- Validates parsing of JDB debugging protocol output
- Tests handling of debugging events, stack traces, variable inspection, and thread management
- Breakpoint lifecycle management and error condition handling
- VM state detection and debugging session lifecycle management

### Public API Coverage

The test suite validates the complete public interface:
- `JavaAdapterFactory.createAdapter()` - Primary adapter instantiation entry point
- `JavaAdapterFactory.getMetadata()` - Adapter capability and version information
- `JavaAdapterFactory.validateEnvironment()` - Pre-flight environment compatibility checking
- Java utility functions for version detection and environment discovery
- JDB parser methods covering all debugging protocol operations

### Testing Patterns and Architecture

**Mock Strategy**: Extensive use of mocking for subprocess execution, file system access, and event emitter simulation to ensure test isolation and hermetic execution.

**Test Structure**: Consistent AAA (Arrange-Act-Assert) pattern with comprehensive edge case coverage including malformed inputs, missing dependencies, and system configuration variations.

**Integration Flow**: Tests validate the complete workflow from environment detection through adapter creation to debugging protocol handling, ensuring seamless integration between all components.

The test suite guarantees robust error handling, cross-platform compatibility, and reliable integration with the broader MCP debug framework infrastructure.