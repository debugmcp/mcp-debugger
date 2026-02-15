# tests\adapters\rust/
@children-hash: 2d4d9e8a4e2ff8cf
@generated: 2026-02-15T09:01:32Z

## Overall Purpose and Responsibility

This directory contains integration tests for the Rust debug adapter implementation, focusing on validating the adapter's core functionality through isolated smoke testing. The tests ensure that the Rust adapter can properly configure debug sessions, build correct commands for the CodeLLDB debugger, and transform launch configurations without requiring actual debug process execution.

## Key Components and Architecture

The test suite is organized around a dependency injection pattern that enables comprehensive testing while maintaining isolation:

**Integration Test Framework**: Built on mock dependency injection to test the adapter's logic paths without external side effects. All filesystem operations, logging, and process launching are stubbed out while preserving the adapter's core behavior.

**Session Management Testing**: Validates the adapter's ability to configure debug sessions with proper port assignments, host configuration, and session lifecycle management through the RustAdapterFactory.

**Command Construction Validation**: Tests the adapter's ability to build correct CodeLLDB commands, ensuring proper executable paths, port arguments, and platform-specific flags are included in the generated debug commands.

**Configuration Transformation Pipeline**: Verifies the adapter's launch configuration processing, including path resolution, platform-specific binary naming conventions, and environment variable handling.

## Public API Surface

The primary entry point is the **RustAdapterFactory integration testing**, which exercises:
- `createAdapter()` method with injected mock dependencies
- Command building interfaces for CodeLLDB integration
- Launch configuration transformation and normalization methods
- Environment setup and session configuration APIs
- Platform-aware debugging parameter handling

## Internal Organization and Data Flow

The test execution follows a structured pattern:

1. **Setup Phase**: Mock dependencies are instantiated, test environment variables are configured, and platform-specific constants are established
2. **Adapter Instantiation**: RustAdapterFactory creates the adapter with injected mock dependencies to isolate external interactions
3. **Functionality Validation**: Core adapter capabilities are tested including command generation, configuration processing, and environment setup
4. **Cleanup and Isolation**: Environment state is restored to ensure test independence and prevent cross-test contamination

## Important Patterns and Conventions

- **Dependency Injection Testing**: All external dependencies (filesystem, logger, process launcher) are mocked to enable pure integration testing without side effects
- **Platform-Aware Testing**: Tests handle cross-platform differences including Windows binary extensions and Unix-specific LLDB configuration requirements
- **Environment Isolation**: Each test manages its own environment variables with proper setup and teardown to maintain test independence
- **Smoke Testing Strategy**: Focus on critical path validation and contract verification rather than exhaustive edge case coverage
- **No-Process Validation**: Tests verify adapter logic and command generation without actually launching debug processes, enabling fast and reliable test execution

This test directory serves as a critical validation layer ensuring the Rust debug adapter maintains proper integration with CodeLLDB while handling platform-specific requirements and configuration transformations correctly.