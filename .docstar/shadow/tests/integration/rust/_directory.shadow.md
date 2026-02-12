# tests/integration/rust/
@generated: 2026-02-11T23:47:33Z

## Purpose
Integration testing module for the Rust language debugging adapter, providing comprehensive validation of debugging session lifecycle, breakpoint management, and Cargo project integration within the larger debugging system.

## Key Components
- **rust-integration.test.ts**: Primary integration test suite that validates end-to-end Rust debugging functionality through the SessionManager API

## Testing Scope and Coverage
The integration tests validate critical debugging workflows:
- **Session Lifecycle Management**: Creation, validation, and proper cleanup of Rust debug sessions
- **Language-Specific Features**: Cargo project detection and Rust-specific debugging configurations
- **Breakpoint Operations**: Setting breakpoints in Rust source files with graceful error handling
- **Configuration Integration**: DAP (Debug Adapter Protocol) settings including stop-on-entry and just-my-code debugging

## Integration Points
- **SessionManager**: Core dependency for orchestrating debug sessions across the system
- **Production Dependencies**: Uses real dependency injection container to ensure authentic integration testing
- **File System**: Tests against actual Rust project structure (`examples/rust/hello_world/`)
- **Logging Infrastructure**: Integrates with system logging for test isolation and debugging

## Test Architecture Patterns
- **Sequential State Management**: Tests maintain session state across multiple operations to validate complete workflows
- **Resource Isolation**: Uses temporary directories and dedicated log files to prevent test interference
- **Graceful Degradation**: Handles missing test resources without failing the entire suite
- **Production-Like Environment**: Leverages actual production dependencies rather than mocks for authentic integration validation

## Public API Validation
Tests verify the SessionManager's public interface for Rust debugging:
- Session creation with language-specific parameters
- Breakpoint setting operations
- Session retrieval and validation
- Proper resource cleanup and state management

This module serves as a quality gate ensuring the Rust debugging adapter integrates correctly with the broader debugging infrastructure before deployment.