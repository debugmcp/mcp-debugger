# packages/adapter-java/tests/unit/
@generated: 2026-02-10T01:19:44Z

## Java Debug Adapter Test Suite

This directory contains comprehensive unit tests for the Java debug adapter implementation, providing test coverage for adapter factory functionality, Java environment utilities, and JDB output parsing capabilities.

### Overall Purpose

The test suite validates the complete Java debugging pipeline from environment detection through debug session management. It ensures the adapter can properly:
- Detect and validate Java installations across different versions
- Parse and interpret Java Debugger (JDB) output for debugging operations
- Create and configure debug adapter instances with proper metadata

### Key Components and Integration

**JavaAdapterFactory Tests (`java-adapter-factory.test.ts`)**
- Entry point validation for adapter creation and configuration
- Tests adapter instantiation, metadata retrieval, and environment validation
- Validates compatibility across Java versions (8+ requirement enforcement)
- Comprehensive mock-based testing of external dependencies

**Java Environment Utilities Tests (`java-utils.test.ts`)**
- Core infrastructure testing for Java detection and version parsing
- Tests subprocess execution for Java version retrieval and command discovery
- Validates JAVA_HOME detection and environment configuration
- Provides pluggable command finder testing for dependency injection

**JDB Parser Tests (`jdb-parser.test.ts`)**
- Runtime debugging functionality validation through JDB output parsing
- Tests extraction of debugging events (breakpoints, steps, errors)
- Validates stack trace parsing, variable inspection, and thread management
- Ensures proper VM state detection and session lifecycle handling

### Test Architecture Patterns

**Comprehensive Mocking Strategy**
- All external dependencies (file system, process execution, environment) are mocked
- Test isolation through beforeEach cleanup and mock reset
- Dependency injection pattern enables controlled testing environments

**Multi-Scenario Coverage**
- Success paths: Valid Java installations, proper JDB responses
- Failure modes: Missing dependencies, version incompatibility, malformed output
- Edge cases: Timeout scenarios, null handling, state transitions

**Mock Utilities and Helpers**
- `simulateSpawn`: Async process simulation for subprocess testing
- `createDependencies`: Factory for mock adapter dependencies
- `MockCommandFinder`: Test implementation for command discovery testing

### Public Testing Interface

The test suite validates these key adapter capabilities:
- `JavaAdapterFactory.createAdapter()`: Adapter instance creation
- `JavaAdapterFactory.getMetadata()`: Adapter information retrieval
- `validateEnvironment()`: Java installation compatibility checking
- `JdbParser` methods: Complete debugging output interpretation

### Internal Test Organization

**Layered Testing Approach**
1. **Environment Layer**: Java detection, version parsing, and validation
2. **Factory Layer**: Adapter creation, configuration, and metadata
3. **Parser Layer**: Runtime debug output processing and state management

**Data Flow Testing**
- Environment detection → Factory validation → Adapter creation
- JDB output → Parser processing → Structured debugging events
- Mock data flows through realistic debugging scenarios

### Testing Conventions

- **AAA Pattern**: Arrange-Act-Assert structure throughout all tests
- **Null Safety**: Extensive validation of parser null returns for invalid input
- **Type Safety**: Comprehensive testing of type inference and object expansion
- **State Validation**: VM lifecycle and debugging session state management
- **Error Propagation**: Proper error handling and message validation testing

The test suite ensures the Java debug adapter can reliably detect Java environments, create functional debug sessions, and interpret JDB debugging output across various Java versions and debugging scenarios.