# tests\adapters\go/
@generated: 2026-02-12T21:06:06Z

## Purpose
Comprehensive test suite for the Go debugger adapter, providing complete validation coverage from unit-level component testing to integration-level smoke testing. This directory ensures the Go adapter maintains reliable integration with Go's native debugging toolchain (Go + Delve) while properly implementing the Debug Adapter Protocol (DAP) specification.

## Overall Architecture
The test directory employs a two-tier testing strategy that validates the Go adapter at different levels of abstraction:

**Unit Testing Layer (`unit/`)**: Deep validation of individual components with comprehensive mocking of external dependencies. Tests focus on internal logic, state management, and API contracts without external system dependencies.

**Integration Testing Layer (`integration/`)**: End-to-end smoke tests that validate the complete adapter pipeline using controlled mocks. Tests ensure proper command building, configuration transformation, and metadata reporting without launching actual debugger processes.

## Key Components & Relationships

### Test Infrastructure
- **Mock Management**: Centralized mocking strategy using `createMockDependencies` that provides consistent test doubles across both unit and integration tests
- **Process Simulation**: EventEmitter-based mocking of child_process.spawn for Go/Delve process interaction
- **Environment Control**: Systematic PATH and environment variable manipulation for testing various development configurations
- **Cross-Platform Support**: Platform-aware testing that validates executable discovery and path resolution

### Component Testing Coverage
- **GoAdapterFactory**: Factory pattern validation, metadata reporting, and environment compatibility
- **GoDebugAdapter**: Core adapter lifecycle, DAP protocol implementation, and debugger communication
- **Utilities**: Go/Delve executable discovery, version parsing, and cross-platform tool detection

### Integration Validation
- **Command Building**: End-to-end validation of dlv DAP command generation with proper configuration
- **Launch Configuration**: Transformation testing from generic debug configs to Go-specific format
- **Dependency Reporting**: Validation of tool requirements (Go 1.18+, Delve with DAP support) and installation guidance

## Public API Testing Surface

### Primary Entry Points
- **Factory Interface**: `GoAdapterFactory` creation, language validation (DebugLanguage.GO), and metadata retrieval
- **Adapter Lifecycle**: Initialization, connection management, and disposal with proper state transitions
- **Tool Discovery**: Cross-platform executable discovery and version compatibility validation
- **Protocol Support**: DAP capabilities, exception filters (panic/fatal), and feature validation (breakpoints, log points)

### State Management
Tests validate proper adapter state transitions:
- UNINITIALIZED → READY (initialization)
- READY → CONNECTED (debugger attachment)  
- CONNECTED → DISCONNECTED (session cleanup)
- Error states and recovery mechanisms

## Internal Organization & Data Flow

### Test Execution Strategy
1. **Component Isolation**: Unit tests validate individual classes with mocked dependencies
2. **Integration Pipeline**: Smoke tests validate complete workflows using controlled environment
3. **Error Scenario Coverage**: Both layers test failure modes and graceful degradation
4. **Platform Compatibility**: Tests adapt to current platform while validating cross-platform logic

### Quality Assurance Patterns
- **Smoke Testing**: Lightweight integration validation without heavy resource usage
- **Dependency Injection**: Consistent mock factories enable reliable, isolated testing
- **Event-Driven Validation**: Tests verify proper event emission during adapter lifecycle
- **Compatibility Matrix**: Version parsing and tool compatibility validation across Go/Delve versions

## Dependencies & Integration
- **Core Module**: `@debugmcp/adapter-go` (classes under test)
- **Shared Infrastructure**: `@debugmcp/shared` (interfaces, enums, base classes)
- **Testing Framework**: Vitest with comprehensive mocking capabilities
- **System Integration**: Node.js built-ins (child_process, fs, path) for tool discovery and process management

This test directory serves as a comprehensive quality gate ensuring the Go adapter maintains correct behavior, proper DAP protocol implementation, and reliable integration with Go's development ecosystem across code changes and platform variations.