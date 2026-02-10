# packages/adapter-java/tests/
@generated: 2026-02-09T18:16:36Z

## Overall Purpose and Responsibility

This directory contains the complete test suite for the Java debug adapter's core functionality within the MCP debugging framework. It provides comprehensive validation of the adapter's ability to detect Java environments, manage debugging sessions, and parse Java Debugger (jdb) output into structured debugging protocol data. The tests ensure reliable Java application debugging across different Java versions and system configurations.

## Key Components and Integration

The test directory is organized into a three-layer architecture that mirrors the adapter's internal structure:

### Factory Layer (`java-adapter-factory.test.ts`)
- **Role**: Tests the primary entry point for Java debug adapter creation and orchestration
- **Integration**: Validates coordination between environment detection, metadata generation, and adapter instantiation
- **Dependencies**: Relies on mocked java-utils functions to isolate factory-specific logic

### Utility Layer (`java-utils.test.ts`)
- **Role**: Tests foundational Java environment detection and management capabilities
- **Core Functions**: Java version parsing, executable path resolution, JAVA_HOME detection, and command finding
- **Process Simulation**: Uses complex EventEmitter mocking to simulate realistic child process behavior for Java version detection

### Parser Layer (`jdb-parser.test.ts`)
- **Role**: Tests transformation of raw Java Debugger output into structured debugging protocol data
- **Data Processing**: Validates parsing of debugging events, stack traces, variables, threads, and breakpoints
- **Error Resilience**: Ensures graceful handling of malformed or unexpected debugger output

## Public API Surface

### Primary Entry Points
- **Adapter Creation**: `JavaAdapterFactory.createAdapter()` - Main adapter instantiation
- **Environment Validation**: `JavaAdapterFactory.isEnvironmentSupported()` - Comprehensive Java environment checking
- **Metadata Access**: `JavaAdapterFactory.getMetadata()` - Adapter capabilities and supported file types

### Utility Interface
- **Environment Detection**: Version parsing, executable finding, JAVA_HOME resolution
- **Command Management**: Configurable command finder system with validation
- **Version Compatibility**: Support for both legacy (1.x) and modern (9+) Java version formats

### Parser Interface
- **Event Processing**: Debugging events, errors, and session state changes
- **State Inspection**: Stack traces, local variables, thread information
- **Session Management**: VM lifecycle and prompt detection

## Internal Organization and Data Flow

### Testing Architecture
The test suite follows a hierarchical structure where:
1. **Factory tests** validate high-level orchestration and depend on mocked utility functions
2. **Utility tests** verify low-level Java environment interaction with isolated process simulation
3. **Parser tests** ensure accurate data transformation from jdb output to debugging protocol structures

### Mock Strategy
- **Comprehensive Isolation**: Each layer uses extensive mocking to test units in isolation
- **Realistic Simulation**: Process mocking includes actual Java command output formats
- **State Management**: Consistent beforeEach/afterEach cleanup ensures test independence
- **Environment Control**: Careful preservation and restoration of system environment variables

## Important Patterns and Conventions

### Error Handling
- **Graceful Degradation**: All components return sensible defaults for invalid input
- **Detailed Reporting**: Environment validation provides specific failure reasons
- **Consistent Signaling**: Error conditions communicated through return values rather than exceptions

### Testing Standards
- **Comprehensive Coverage**: Both positive and negative test paths for all functionality
- **Type Safety**: Extensive TypeScript assertions and typed mock objects
- **Realistic Data**: Test fixtures use actual Java debugger output formats
- **Layered Dependencies**: Factory tests build upon utility test foundations

### Integration Points
- **Shared Types**: Utilizes `@debugmcp/shared` for common debugging protocol interfaces
- **Cross-Layer Validation**: Tests ensure proper data flow from environment detection through debugging protocol output
- **Version Compatibility**: Validates adapter functionality across Java 8+ versions and different system configurations

This test directory ensures the Java adapter can reliably establish debugging sessions and provide accurate debugging information across diverse Java environments and use cases.