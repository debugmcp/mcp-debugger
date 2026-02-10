# tests/adapters/go/integration/go-session-smoke.test.ts
@source-hash: a3269bf73a8fcfae
@generated: 2026-02-10T00:41:12Z

## Purpose
Integration smoke test for the Go debugger adapter, validating core functionality without launching actual debugger processes.

## Test Structure
- **Test Suite** (L44-153): `Go adapter - session smoke (integration)`
- **Mock Dependencies** (L8-42): Creates fake AdapterDependencies with no-op implementations
- **Environment Setup** (L54-65): Manages DLV_PATH environment variable for testing

## Key Test Cases

### Command Building (L67-86)
- Tests `buildAdapterCommand()` method
- Validates dlv DAP command generation with TCP port configuration
- Verifies command path is absolute and executable exists
- Checks for required 'dap' argument and listen parameter format

### Launch Configuration (L88-106) 
- Tests `transformLaunchConfig()` for normal Go programs
- Validates standard debug mode configuration
- Ensures proper handling of program path, cwd, args, and env

### Test Mode Configuration (L108-123)
- Tests Go test mode support via `transformLaunchConfig()`
- Validates test-specific argument handling (-test.v, -test.run)
- Ensures mode is correctly set to 'test'

### Metadata Validation (L125-132)
- Tests factory metadata exposure
- Validates display name, file extensions (.go), and description

### Dependencies & Installation (L134-152)
- Tests required dependencies reporting (Go + Delve)
- Validates installation instructions contain expected references

## Test Configuration
- **Test Port**: 48766 (L45)
- **Session ID**: 'session-go-smoke' (L46) 
- **Fake DLV Path**: Uses process.execPath as mock delve binary (L50)
- **Sample Paths**: References examples/go/main.go and examples/go-hello (L49, L91)

## Dependencies
- **vitest**: Test framework
- **@debugmcp/shared**: AdapterDependencies type
- **@debugmcp/adapter-go**: GoAdapterFactory class
- **fs/path**: File system utilities

## Architecture Notes
- Mock processLauncher throws error to prevent actual process execution (L38-40)
- All file system operations return empty/false values for isolation
- Environment access uses real process.env but with controlled DLV_PATH