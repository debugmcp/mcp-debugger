# tests\adapters\rust/
@generated: 2026-02-12T21:05:50Z

## Purpose
Integration testing suite for the Rust debugging adapter that validates core adapter functionality through comprehensive end-to-end testing without external process dependencies. This module ensures the Rust adapter correctly handles session management, command building, and launch configuration transformation across different platforms.

## Key Components and Architecture

**Testing Infrastructure**:
- **Mock Dependency Framework**: Complete stubbing system for external dependencies (FileSystem, Logger, ProcessLauncher) enabling isolated adapter testing
- **Environment Management System**: Controlled manipulation and cleanup of environment variables (CODELLDB_PATH, RUST_BACKTRACE) between test runs
- **Cross-Platform Test Support**: Platform-aware testing infrastructure handling Windows vs Unix binary differences and environment variable behaviors

**Core Test Coverage**:
- **Adapter Factory Integration**: End-to-end validation of RustAdapterFactory creation and configuration processes
- **Command Generation Testing**: Verification of CodeLLDB debugger command construction with proper executable paths, port configurations, and platform-specific flags
- **Configuration Transformation Validation**: Testing of launch configuration normalization, path resolution, and output format standardization

## Testing Strategy

The directory implements a **smoke testing approach** that validates critical adapter functionality without spawning actual debugging processes:

1. **Dependency Injection Pattern**: Mock implementations replace real file system operations and process launches while maintaining realistic test scenarios
2. **Session Lifecycle Validation**: Tests cover adapter initialization, configuration processing, and command generation phases
3. **Platform Compatibility Testing**: Ensures consistent adapter behavior across Windows and Unix environments with appropriate platform-specific assertions

## Public API and Entry Points

- **Integration Test Suite**: Primary validation of RustAdapterFactory and core adapter functionality
- **Mock Factory Functions**: Test utilities for creating controlled adapter dependencies
- **Environment Setup/Teardown**: Test lifecycle management for consistent testing conditions
- **Cross-Platform Test Scenarios**: Platform-specific test cases validating adapter behavior differences

## Internal Organization

The integration tests focus on **adapter contract validation** rather than external tool integration, using Vitest framework with proper test isolation through beforeEach/afterEach hooks. Tests validate command structure correctness (executable paths, arguments, flags) and environment configuration (RUST_BACKTRACE, LLDB settings) while maintaining clear separation between adapter logic testing and actual debugging process management.

This testing approach ensures the Rust adapter meets its contract obligations for debugging session setup while remaining independent of external CodeLLDB processes and file system state.