# tests\adapters\go\unit/
@children-hash: 56bf9d98958b1051
@generated: 2026-02-24T01:54:51Z

## Overview
This directory contains comprehensive unit tests for the Go debug adapter implementation, providing thorough validation of the adapter factory, core adapter functionality, and utility functions. The test suite ensures reliable integration with Go toolchain and Delve debugger across different platforms and environments.

## Test Architecture

### Factory Testing (`go-adapter-factory.test.ts`)
Tests the GoAdapterFactory class responsible for creating and configuring Go debug adapter instances:
- **Adapter Creation**: Validates proper GoDebugAdapter instantiation with correct language metadata
- **Environment Validation**: Comprehensive testing of Go/Delve availability, version compatibility (Go ≥ 1.18), and DAP support detection
- **Metadata Validation**: Tests adapter metadata including display name, version, file extensions, documentation URLs, and icons

### Core Adapter Testing (`go-debug-adapter.test.ts`) 
Tests the GoDebugAdapter class that manages debug session lifecycle:
- **State Management**: Validates state transitions (UNINITIALIZED → READY → CONNECTED) and event emission
- **Dependency Validation**: Tests Go and Delve availability checks during initialization
- **DAP Integration**: Tests Debug Adapter Protocol command building and capabilities
- **Configuration Translation**: Tests launch configuration transformation from generic to Go-specific format
- **Error Handling**: Validates user-friendly error message translation for common issues

### Utility Function Testing (`go-utils.test.ts`)
Tests platform-specific utility functions for Go development environment:
- **Executable Discovery**: Tests finding Go and Delve executables via preferred paths, PATH, and GOPATH/bin
- **Version Detection**: Tests parsing Go and Delve version strings from command output
- **DAP Support Validation**: Tests detection of Debug Adapter Protocol support in Delve
- **Cross-Platform Compatibility**: Tests path generation and executable discovery across Windows, Linux, and macOS

## Common Testing Patterns

### Mock Infrastructure
All tests use a consistent mocking strategy:
- **Process Mocking**: child_process.spawn mocked with EventEmitter-based simulation
- **File System Mocking**: fs.promises.access mocked for executable existence checks
- **Environment Management**: Comprehensive save/restore patterns for PATH, GOPATH, GOBIN variables
- **Dependency Injection**: Mock AdapterDependencies factory providing stubbed logger, file system, and process launcher

### Test Organization
- **Setup/Teardown**: Consistent beforeEach/afterEach hooks for mock cleanup
- **Error Simulation**: Tests both success and failure scenarios with proper error propagation
- **Async Patterns**: Proper handling of asynchronous operations with process.nextTick() simulation
- **Platform Awareness**: Tests adapt behavior based on process.platform for cross-platform validation

## Integration Points
The tests validate the complete Go debug adapter pipeline:
1. **Factory** creates and validates adapter instances
2. **Adapter** manages debug session state and DAP communication
3. **Utilities** provide platform-specific Go toolchain integration

This comprehensive test coverage ensures reliable Go debugging functionality across different development environments and platforms, with proper error handling and user feedback for common setup issues.