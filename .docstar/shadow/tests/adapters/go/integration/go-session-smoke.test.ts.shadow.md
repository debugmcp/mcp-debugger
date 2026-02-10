# tests/adapters/go/integration/go-session-smoke.test.ts
@source-hash: a3269bf73a8fcfae
@generated: 2026-02-09T18:14:13Z

## Purpose
Integration smoke test suite for the Go debugging adapter, validating core functionality without requiring actual process launch. Tests adapter command generation, launch configuration transformation, and factory methods.

## Test Structure
- **Test Suite** (L44-153): "Go adapter - session smoke (integration)"
- **Mock Dependencies Factory** (L8-42): Creates stub `AdapterDependencies` with no-op implementations
- **Setup/Teardown** (L54-65): Manages `DLV_PATH` environment variable for test isolation

## Key Test Cases

### Command Building Test (L67-86)
- Verifies `buildAdapterCommand` generates proper dlv DAP command
- Validates TCP port configuration and absolute path resolution
- Uses fake dlv path (`process.execPath`) to avoid delve dependency

### Launch Config Transformation Tests
- **Normal Mode** (L88-106): Tests standard Go program configuration normalization
- **Test Mode** (L108-123): Validates test-specific configuration handling
- Both verify proper `type`, `request`, `mode`, and path handling

### Factory Metadata Tests (L125-152)
- **Metadata Validation** (L125-132): Checks display name, file extensions, description
- **Dependencies** (L134-142): Verifies Go and Delve dependency reporting
- **Installation Instructions** (L144-152): Validates setup guidance content

## Configuration Constants
- `adapterPort`: 48766 (L45)
- `sessionId`: 'session-go-smoke' (L46) 
- `adapterHost`: '127.0.0.1' (L47)
- Sample paths for Go examples and fake dlv executable (L48-50)

## Dependencies
- `@debugmcp/adapter-go`: GoAdapterFactory for adapter creation
- `@debugmcp/shared`: AdapterDependencies type definition
- Standard Node.js modules: path, fs, vitest testing framework

## Architectural Notes
- Uses dependency injection pattern with mock implementations
- Avoids actual process spawning via error-throwing processLauncher mock (L37-41)
- Environment variable isolation ensures test independence