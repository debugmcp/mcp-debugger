# tests/integration/rust/
@generated: 2026-02-09T18:16:03Z

## Rust Integration Testing Module

**Primary Purpose:** Comprehensive integration testing for Rust debugging capabilities within the debug session management system. This module validates the complete end-to-end workflow of the Rust debug adapter, from session creation to breakpoint management.

### Module Organization

**Core Test Suite** (`rust-integration.test.ts`): The primary entry point containing all integration tests for Rust debugging functionality. The test suite follows a standard lifecycle pattern with setup, execution, and teardown phases to ensure isolated and reliable testing.

### Key Components & Data Flow

1. **Test Environment Setup**: Creates production-grade dependencies with debug logging and configures SessionManager with temporary directories for complete isolation
2. **Session Management**: Tests session lifecycle including creation, configuration, and termination using the SessionManager as the central orchestrator
3. **Language-Specific Testing**: Validates Rust-specific functionality including Cargo project handling and source file debugging
4. **Breakpoint Operations**: Tests breakpoint setting and management in Rust source files with graceful fallback handling

### Public API Surface

- **Integration Test Entry Point**: Main test suite accessible via standard Vitest test runner
- **Rust Debug Session Validation**: Comprehensive testing of Rust debug adapter functionality
- **Session Lifecycle Testing**: End-to-end validation of debug session creation, operation, and cleanup

### Architecture Dependencies

The module integrates with core system components:
- **SessionManager**: Central session lifecycle management from the main application
- **Dependencies Container**: Production dependency injection system
- **Shared Types**: Language enumeration (`DebugLanguage.RUST`) from shared package
- **File System Operations**: Cross-platform path and temporary directory handling

### Testing Patterns & Conventions

- **Isolation Strategy**: Uses temporary directories and separate logging to prevent test interference
- **Graceful Degradation**: Tests pass even when example Rust projects are unavailable, ensuring CI/CD reliability
- **State Management**: Maintains session state across test cases while ensuring proper cleanup
- **Production Fidelity**: Uses actual production dependencies rather than mocks for realistic integration testing

### Critical Test Scenarios

1. **Basic Session Creation**: Validates Rust debug session instantiation and configuration
2. **Project Integration**: Tests integration with Cargo-based Rust projects
3. **Breakpoint Management**: Validates setting breakpoints in Rust source files
4. **Session Cleanup**: Ensures proper resource management and session termination

The module serves as the definitive validation suite for Rust debugging capabilities, ensuring the debug adapter functions correctly within the broader debug session management ecosystem.