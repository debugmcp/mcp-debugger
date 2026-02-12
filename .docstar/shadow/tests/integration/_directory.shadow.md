# tests/integration/
@generated: 2026-02-11T23:47:43Z

## Purpose
Integration testing directory that provides comprehensive end-to-end validation of language-specific debugging adapters within the broader debugging system. This module ensures that debugging functionality works correctly across the entire stack, from debug session management to language-specific features and protocol integration.

## Key Components
- **rust/**: Complete integration test suite for Rust language debugging adapter, validating session lifecycle, breakpoint management, and Cargo project integration

## Testing Architecture and Scope
The integration tests validate critical cross-system workflows:
- **End-to-End Debug Sessions**: Complete debugging workflows from session creation through cleanup
- **Language Adapter Integration**: Validation that language-specific adapters integrate correctly with the core debugging infrastructure
- **Protocol Compliance**: DAP (Debug Adapter Protocol) implementation testing with real debugging scenarios
- **Production Environment Simulation**: Uses actual production dependencies and file system interactions rather than mocks

## Integration Points and Dependencies
- **SessionManager API**: Primary interface for orchestrating debug sessions across all language adapters
- **Production Dependency Container**: Ensures authentic integration testing with real system components
- **File System Integration**: Tests against actual project structures and source files
- **Logging Infrastructure**: System-wide logging integration for test isolation and debugging

## Public API Validation
Integration tests serve as comprehensive validation of the debugging system's public interfaces:
- Session creation and management across different languages
- Breakpoint operations and state management
- Configuration handling for language-specific debugging features
- Resource cleanup and proper session lifecycle management

## Test Organization Patterns
- **Language-Specific Modules**: Each supported language has dedicated integration test coverage
- **Production-Like Testing**: Uses real dependencies and actual project files to ensure authentic validation
- **Resource Isolation**: Temporary directories and dedicated logging prevent test interference
- **Sequential Workflow Testing**: Validates complete debugging scenarios rather than isolated operations

This directory serves as the quality gate ensuring that all language debugging adapters integrate seamlessly with the core debugging infrastructure, providing confidence that the system works correctly in real-world debugging scenarios before deployment.