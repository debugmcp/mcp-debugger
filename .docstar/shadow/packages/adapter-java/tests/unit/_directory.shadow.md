# packages/adapter-java/tests/unit/
@generated: 2026-02-09T18:16:15Z

## Overall Purpose
This directory contains comprehensive unit test coverage for the Java debug adapter's core functionality. It validates the adapter factory, Java environment utilities, and JDB (Java Debugger) output parsing capabilities that enable debugging Java applications within the MCP debugging framework.

## Key Components and Architecture

### JavaAdapterFactory Testing (`java-adapter-factory.test.ts`)
- **Primary Role**: Tests the main entry point for Java debug adapter creation
- **Coverage Areas**: Adapter instantiation, metadata validation, and Java environment compatibility checking
- **Environment Validation**: Comprehensive testing of Java version requirements (minimum Java 8), executable detection, and jdb tool availability
- **Mock Strategy**: Extensive mocking of java-utils functions to isolate factory logic

### Java Utilities Testing (`java-utils.test.ts`) 
- **Primary Role**: Tests foundational Java environment detection and management utilities
- **Core Functions**: Java version parsing (legacy 1.x and modern 9+ formats), executable path resolution, JAVA_HOME detection, and command finding mechanisms
- **Process Simulation**: Complex EventEmitter mocking to simulate child process behavior for `java -version` execution
- **Error Handling**: Validates graceful handling of missing tools, invalid versions, and process failures

### JDB Parser Testing (`jdb-parser.test.ts`)
- **Primary Role**: Tests parsing of Java Debugger command output into structured debugging data
- **Parser Coverage**: Stopped events, stack traces, local variables, thread information, breakpoint management, and error messages
- **Data Transformation**: Validates conversion of raw jdb text output into typed objects for debugging protocol consumption
- **Edge Case Handling**: Tests both successful parsing and graceful handling of malformed or unexpected output

## Public API Surface and Entry Points

### Adapter Factory Interface
- `JavaAdapterFactory.createAdapter()`: Main adapter instantiation method
- `JavaAdapterFactory.getMetadata()`: Returns adapter capabilities and supported file types
- `JavaAdapterFactory.isEnvironmentSupported()`: Environment validation with detailed error reporting

### Utility Functions
- **Version Management**: `parseJavaMajorVersion()`, `getJavaVersion()`
- **Environment Detection**: `findJavaHome()`, `findJavaExecutable()`, `findJdb()`, `validateJdb()`
- **Command Resolution**: Configurable command finder system with `setDefaultCommandFinder()`

### Parser Interface
- **Event Parsing**: `parseStoppedEvent()`, `parseError()`, `parseBreakpointSet()/Cleared()`
- **State Inspection**: `parseStackTrace()`, `parseLocals()`, `parseThreads()`
- **Session Management**: `isPrompt()`, `extractPrompt()`, `isVMStarted()`, `isTerminated()`

## Internal Organization and Data Flow

### Testing Hierarchy
1. **Factory Layer**: Tests high-level adapter creation and validation orchestration
2. **Utility Layer**: Tests low-level Java environment interaction and detection
3. **Parser Layer**: Tests debugging protocol data transformation

### Mock Architecture
- **Isolation Strategy**: Each test suite uses comprehensive mocking to isolate units under test
- **Process Simulation**: Complex EventEmitter mocking for realistic child process behavior
- **Environment Control**: Careful preservation and restoration of process.env for test independence
- **Dependency Injection**: Mock factories provide configurable test dependencies

## Important Patterns and Conventions

### Testing Patterns
- **beforeEach/afterEach Cleanup**: Consistent mock state management across test suites
- **Positive/Negative Path Testing**: All functions tested with both success and failure scenarios
- **Type Safety**: Extensive use of TypeScript assertions and typed mock objects
- **Realistic Data Simulation**: Uses actual Java command output formats in test fixtures

### Error Handling Conventions
- **Graceful Degradation**: All parsers return sensible defaults for invalid input
- **Detailed Error Reporting**: Environment validation provides specific failure reasons
- **Null/Empty Returns**: Consistent error signaling through return values rather than exceptions

### Integration Points
- **Shared Types**: Uses `@debugmcp/shared` for common debugging protocol interfaces
- **Mock Coordination**: Factory tests depend on utility function mocks, creating a layered testing approach
- **Data Flow Validation**: Tests ensure proper transformation from raw jdb output through parser to debugging protocol structures

This test suite ensures the Java adapter can reliably detect Java environments, create debugging sessions, and parse debugger output across different Java versions and configurations.