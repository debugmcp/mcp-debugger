# tests\adapters\go\integration/
@generated: 2026-02-12T21:05:39Z

## Purpose
Integration test directory for the Go debugger adapter, containing smoke tests that validate core functionality and configuration transformations without launching actual debugger processes.

## Overall Architecture
This directory provides isolated integration testing for the Go adapter by creating a controlled test environment with mocked dependencies. The tests focus on validating the adapter's ability to:
- Build correct debugger commands (dlv DAP)
- Transform launch configurations for different Go execution modes
- Report metadata and dependencies accurately
- Handle environment setup properly

## Key Components

### Test Environment Setup
- **Mock Dependencies**: Creates fake `AdapterDependencies` with no-op implementations to prevent actual process launches and file system interactions
- **Environment Management**: Controls DLV_PATH environment variable using process.execPath as a mock delve binary
- **Isolation Strategy**: All external dependencies (file system, process launcher) return safe default values

### Core Test Coverage
- **Command Building**: Validates dlv DAP command generation with proper TCP port configuration and executable validation
- **Launch Configuration**: Tests transformation of launch configs for both normal Go programs and test mode execution
- **Metadata Validation**: Ensures factory properly reports display name, supported file extensions (.go), and descriptions
- **Dependencies**: Validates reporting of required tools (Go + Delve) and installation instructions

## Test Configuration
- **Test Port**: 48766 for DAP communication testing
- **Session Management**: Uses controlled session ID ('session-go-smoke') for reproducible tests
- **Sample Paths**: References standardized example files (examples/go/main.go, examples/go-hello)

## Integration Points
The tests validate the `GoAdapterFactory` class from `@debugmcp/adapter-go` by:
- Testing public methods: `buildAdapterCommand()`, `transformLaunchConfig()`, factory metadata
- Ensuring proper integration with shared adapter interfaces from `@debugmcp/shared`
- Validating compatibility with the broader debugger adapter ecosystem

## Test Strategy
Uses **smoke testing** approach - lightweight validation of critical paths without heavy resource usage or external dependencies. The mocked environment ensures tests are:
- Fast and reliable (no actual debugger processes)
- Isolated from system configuration
- Focused on adapter logic rather than external tool behavior

This directory serves as a quality gate ensuring the Go adapter maintains correct behavior and integration compatibility across code changes.