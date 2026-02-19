# tests\integration/
@children-hash: dba87af57d6bf56e
@generated: 2026-02-19T23:48:25Z

## Purpose and Responsibility

The `tests/integration` directory contains comprehensive integration tests for the DebugMCP framework's language-specific debugging adapters. It serves as the primary validation layer for end-to-end debugging workflows, ensuring that the complete debugging infrastructure functions correctly from session creation through breakpoint management to resource cleanup across different programming languages.

## Key Components and Integration

**Language-Specific Test Suites**: Currently contains Rust integration testing with a structured approach that can be extended to other languages:

- **Rust Integration Tests** (`rust/`): Complete end-to-end testing of Rust debugging capabilities including Cargo project recognition, DAP adapter configuration, and source-level debugging

**Core Integration Points**:
- **Session Management Testing**: Validates `SessionManager` lifecycle and persistence across debugging operations
- **Adapter Configuration Validation**: Tests language-specific debugging adapter setup and DAP communication
- **Breakpoint System Integration**: Verifies breakpoint setting, status verification, and graceful error handling
- **Project Detection**: Tests language-specific project recognition and configuration (e.g., Cargo for Rust)

## Public API Surface

**Main Test Entry Points**:
- Language-specific test suites (e.g., `Rust Adapter Integration`) that provide comprehensive coverage for each supported debugging language
- Integration test scenarios covering session creation, persistence, breakpoint management, and cleanup

**Key Test Coverage Areas**:
- Session lifecycle management with production dependencies
- Language adapter configuration and DAP integration
- Breakpoint operations with fallback handling
- Resource management and cleanup verification

## Internal Organization and Data Flow

**Integration Test Architecture**:
1. **Production Environment Testing**: Uses actual production `SessionManager` and dependency injection rather than mocks for realistic validation
2. **Graceful Degradation**: Tests designed to pass even when example projects or compiled binaries are unavailable
3. **Resource Isolation**: Temporary directory management ensures test isolation and prevents filesystem conflicts
4. **Cross-Operation State**: Maintains session references across test methods to verify persistent state and lifecycle management

**Dependency Integration Flow**:
- Integrates with production `SessionManager` and core debugging infrastructure
- Leverages shared language constants and utilities from `@debugmcp/shared`
- Uses Node.js filesystem utilities for temporary resource management
- Configures debug logging with custom locations for troubleshooting

## Important Patterns and Conventions

**Production Integration Testing**: Emphasizes testing with real production dependencies rather than mocks to validate actual system behavior and catch integration issues.

**Language Extension Pattern**: Structured to support adding new language-specific test suites following the established Rust integration model.

**Graceful Error Handling**: Implements try-catch patterns for optional test scenarios, allowing tests to pass when external dependencies (example projects, compilers) are unavailable.

**Resource Management**: Consistent setup/teardown patterns with temporary directories and proper session cleanup to ensure test reliability and isolation.

This directory serves as the critical validation layer for DebugMCP's multi-language debugging capabilities, ensuring that language adapters correctly integrate with the core debugging infrastructure and handle language-specific requirements effectively.