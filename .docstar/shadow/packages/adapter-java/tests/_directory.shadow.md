# packages/adapter-java/tests/
@generated: 2026-02-10T01:19:57Z

## Java Debug Adapter Test Suite

This directory contains the comprehensive test suite for the Java debug adapter, providing complete validation coverage for the adapter's core functionality from environment detection through active debugging session management.

### Overall Purpose and Responsibility

The test suite serves as the quality assurance layer for the Java debug adapter implementation, ensuring reliable debugging capabilities across diverse Java environments. It validates the entire debugging pipeline:
- Java environment detection and compatibility verification
- Debug adapter factory operations and configuration
- Real-time JDB (Java Debugger) output parsing and interpretation
- End-to-end debugging workflow functionality

### Key Components and Integration

The test suite is organized into three complementary testing layers that mirror the adapter's architectural components:

**Environment Validation Layer (`java-utils.test.ts`)**
- Tests Java installation detection and version parsing
- Validates JAVA_HOME configuration and command discovery
- Ensures compatibility enforcement (Java 8+ requirement)
- Provides foundation for all higher-level adapter operations

**Adapter Factory Layer (`java-adapter-factory.test.ts`)**
- Tests adapter instantiation and metadata retrieval
- Validates environment dependency integration
- Ensures proper configuration and initialization workflows
- Serves as the primary entry point validation for adapter creation

**Runtime Parser Layer (`jdb-parser.test.ts`)**
- Tests active debugging session output interpretation
- Validates extraction of breakpoints, steps, variables, and stack traces
- Ensures proper VM state detection and lifecycle management
- Provides the core debugging functionality validation

### Public Testing Interface

The test suite validates the adapter's primary API surface:

**Factory Operations**
- `JavaAdapterFactory.createAdapter()` - Complete adapter instance creation
- `JavaAdapterFactory.getMetadata()` - Adapter capability and version information
- `validateEnvironment()` - Java installation compatibility checking

**Runtime Operations**
- `JdbParser` methods - Complete suite of debugging output interpretation
- Environment utilities - Java detection and configuration validation

### Internal Test Organization and Data Flow

**Layered Testing Architecture**
The tests follow the adapter's natural data flow:
1. Environment detection and validation → 2. Factory-based adapter creation → 3. Runtime debugging operations

**Comprehensive Mock Strategy**
- Complete isolation through mocking of file system, process execution, and environment
- Dependency injection pattern enables controlled testing of all external interactions
- Realistic simulation of Java environments and JDB debugging scenarios

**Mock Utilities Framework**
- `simulateSpawn` - Async process simulation for subprocess testing
- `createDependencies` - Factory for consistent mock adapter dependencies  
- `MockCommandFinder` - Pluggable command discovery for testing flexibility

### Testing Patterns and Conventions

**Multi-Scenario Coverage**
- Success paths: Valid Java installations, proper JDB responses, complete debugging workflows
- Failure modes: Missing dependencies, version incompatibility, malformed debug output
- Edge cases: Timeout scenarios, null handling, VM state transitions

**Quality Assurance Standards**
- AAA Pattern (Arrange-Act-Assert) structure ensures clear test organization
- Comprehensive null safety validation for all parser operations
- Type safety verification and object expansion testing
- State management validation for debugging session lifecycles
- Error propagation and message validation throughout all components

The test suite ensures the Java debug adapter can reliably operate across various Java versions and debugging scenarios, providing confidence in the adapter's ability to deliver consistent debugging experiences.