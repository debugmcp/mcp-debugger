# tests\adapters\go/
@children-hash: b497f9619d94198c
@generated: 2026-02-24T01:55:08Z

## Purpose
Comprehensive test suite for the Go debugger adapter, providing multi-layered validation through both isolated unit tests and integrated smoke tests to ensure reliable Go debugging functionality across different platforms and environments.

## Test Architecture Overview
This directory implements a **dual-layer testing strategy** that provides complete coverage of the Go adapter implementation:

- **Unit Tests** (`unit/`): Fine-grained validation of individual components with extensive mocking
- **Integration Tests** (`integration/`): End-to-end smoke testing with mock dependencies to validate complete workflows

## Key Components and Organization

### Unit Test Layer
The unit test suite provides comprehensive validation of core adapter components:

- **GoAdapterFactory Testing**: Validates adapter creation, environment validation, and metadata exposure
- **GoDebugAdapter Testing**: Tests debug session lifecycle, state management, and DAP protocol integration  
- **Utility Function Testing**: Platform-specific Go toolchain discovery, version detection, and executable resolution

### Integration Test Layer
The integration test suite validates complete adapter workflows:

- **Mock-Based Isolation**: Uses fake dependencies to prevent actual process execution while maintaining API contracts
- **Command Generation Validation**: Tests complete dlv DAP command construction and configuration
- **End-to-End Smoke Tests**: Validates adapter behavior from factory creation through debug session preparation

## Testing Infrastructure and Patterns

### Comprehensive Mocking Strategy
Both test layers share common mocking patterns:
- **Process Mocking**: child_process.spawn simulation with EventEmitter-based process lifecycle
- **File System Mocking**: fs.promises.access stubbing for executable discovery testing
- **Environment Management**: Systematic PATH, GOPATH, GOBIN variable manipulation and restoration
- **Dependency Injection**: Mock AdapterDependencies providing controlled logger, file system, and process launcher

### Cross-Platform Validation
Tests ensure reliable functionality across development environments:
- **Platform-Aware Testing**: Behavior adaptation based on process.platform (Windows, Linux, macOS)
- **Toolchain Discovery**: Validation of Go and Delve executable location across different installation patterns
- **Version Compatibility**: Testing Go ≥ 1.18 requirements and Delve DAP support detection

## Validated Public API Surface
The test suite comprehensively validates the Go adapter's complete public interface:

### Factory Interface
- Adapter instantiation and configuration
- Environment validation and dependency checking
- Metadata exposure (display name, file extensions, documentation)

### Adapter Interface  
- Debug session state management (UNINITIALIZED → READY → CONNECTED)
- Launch configuration transformation for Go-specific debugging
- DAP command generation and capabilities reporting
- Error handling with user-friendly message translation

### Utility Interface
- Cross-platform executable discovery
- Version detection and compatibility validation
- DAP support verification in Delve installations

## Test Data Flow and Validation
Tests follow systematic validation patterns:

1. **Environment Setup**: Mock configuration and dependency injection
2. **Component Execution**: Invoke adapter methods with controlled inputs
3. **Output Validation**: Verify correct command generation, state transitions, and error handling
4. **Isolation Verification**: Ensure no unintended side effects or actual process execution

This comprehensive test architecture ensures the Go debugger adapter reliably integrates with Go toolchain and Delve debugger while providing robust error handling and cross-platform compatibility for diverse development environments.