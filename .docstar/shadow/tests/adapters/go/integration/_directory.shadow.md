# tests/adapters/go/integration/
@generated: 2026-02-10T01:19:34Z

## Purpose
Integration test suite for the Go debugger adapter, providing comprehensive validation of core adapter functionality through smoke testing without launching actual debugger processes.

## Module Organization
This directory contains integration tests that verify the Go adapter's ability to:
- Build proper debugger commands for the Delve (dlv) DAP interface
- Transform launch configurations for both normal programs and test modes
- Expose correct metadata and dependency information
- Handle environment setup and path resolution

## Test Architecture

### Mock Environment (L8-42)
- **AdapterDependencies Mock**: Complete fake implementation preventing actual process execution
- **File System Isolation**: All fs operations return safe defaults (empty/false values)
- **Process Launcher Safety**: Throws errors to prevent accidental debugger launches
- **Environment Control**: Manages DLV_PATH for testing different delve installations

### Core Test Coverage

**Command Generation Testing**
- Validates `buildAdapterCommand()` produces correct dlv DAP commands
- Ensures TCP port configuration and absolute path resolution
- Verifies required DAP arguments and listen parameter format

**Configuration Transformation Testing**  
- Tests `transformLaunchConfig()` for standard Go programs
- Validates Go test mode support with proper argument handling
- Ensures correct mode setting and path/environment processing

**Metadata & Dependencies Testing**
- Validates factory metadata (display name, file extensions, description)
- Tests dependency reporting for Go toolchain and Delve debugger
- Verifies installation instruction content

## Key Entry Points
- **Primary Test Suite**: `Go adapter - session smoke (integration)` (L44-153)
- **Test Configuration**: Uses port 48766 and session ID 'session-go-smoke'
- **Sample Programs**: References examples/go/main.go and examples/go-hello for realistic testing

## Dependencies
- **@debugmcp/adapter-go**: GoAdapterFactory under test
- **@debugmcp/shared**: AdapterDependencies interface for mocking
- **vitest**: Test execution framework
- **Node.js built-ins**: fs, path for file system operations

## Testing Patterns
- **Isolation First**: All external dependencies mocked to prevent side effects
- **Real Configuration**: Uses actual adapter logic with fake infrastructure
- **Environment Simulation**: Controlled DLV_PATH manipulation for installation testing
- **Comprehensive Coverage**: Tests all major adapter methods and configurations

This test suite serves as a safety net ensuring the Go adapter correctly interfaces with the Delve debugger while maintaining complete isolation from actual debugging processes.