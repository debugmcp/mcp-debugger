# tests/adapters/go/integration/
@generated: 2026-02-09T18:16:04Z

## Purpose
Integration test suite for the Go debugging adapter, providing comprehensive smoke testing of core adapter functionality without requiring actual Go runtime or Delve debugger installation. This module validates the Go adapter's integration points, configuration handling, and public API surface through isolated testing scenarios.

## Key Components

### Test Infrastructure
- **Mock Dependencies System**: Creates stub implementations of `AdapterDependencies` to enable testing without external dependencies
- **Environment Isolation**: Manages `DLV_PATH` environment variable for test independence
- **Fake Process Handling**: Uses error-throwing mock process launcher to avoid actual subprocess spawning

### Core Test Coverage
- **Command Generation**: Validates `buildAdapterCommand` produces correct dlv DAP commands with proper TCP configuration
- **Launch Configuration**: Tests transformation of both normal program and test mode configurations
- **Factory Metadata**: Verifies adapter display information, dependency reporting, and installation guidance
- **Path Resolution**: Ensures proper handling of absolute paths and Go project structures

## Public API Validation
The tests exercise key entry points from `@debugmcp/adapter-go`:
- `GoAdapterFactory.create()` - Primary factory method for adapter instantiation
- `buildAdapterCommand()` - Command line generation for Delve DAP server
- Configuration transformation for launch requests
- Metadata reporting (display name, file extensions, dependencies)

## Integration Patterns

### Dependency Injection
Uses mock `AdapterDependencies` with no-op implementations to isolate adapter logic from system dependencies while maintaining the same interface contracts used in production.

### Configuration Testing
Validates the adapter's ability to handle different Go debugging scenarios:
- Standard Go program debugging with proper `type`, `request`, and `mode` settings
- Go test debugging with test-specific configuration handling
- Path normalization and workspace root resolution

### Metadata Verification
Ensures the adapter properly reports its capabilities and requirements:
- File extension associations (.go files)
- Runtime dependencies (Go toolchain, Delve debugger)
- User-facing installation and setup instructions

## Test Architecture
- **Smoke Testing Focus**: Validates core functionality without deep integration
- **No External Dependencies**: Uses fake paths and mock implementations to avoid requiring Go/Delve installation
- **Comprehensive Coverage**: Tests command building, configuration handling, and factory methods in isolation

This integration test module serves as the primary validation point for the Go adapter's public API and ensures reliable operation across different configuration scenarios without environmental dependencies.