# tests\adapters\rust\integration/
@children-hash: 2ea2c736d88545de
@generated: 2026-02-15T09:01:19Z

## Overall Purpose and Responsibility

This directory contains integration tests for the Rust debug adapter, specifically focused on smoke testing the adapter's core functionality without launching actual debug processes. The tests validate that the Rust adapter can properly configure debug sessions, build correct commands for the CodeLLDB debugger, and transform launch configurations appropriately.

## Key Components and Architecture

The integration test suite is built around a dependency injection pattern that enables isolated testing:

**Mock Dependencies Factory**: Creates stubbed implementations of all external dependencies (filesystem, logger, process launcher) to prevent side effects during testing while maintaining the adapter's core logic paths.

**Session Configuration Testing**: Validates the adapter's ability to set up debug sessions with proper port assignments, host configuration, and session management.

**Command Building Validation**: Tests the adapter's command construction for CodeLLDB, ensuring correct executable paths, port arguments, and platform-specific flags are included.

**Launch Configuration Transformation**: Verifies the adapter can normalize and transform debug launch configurations, particularly handling path resolution and platform-specific binary naming conventions.

## Public API Surface

The main entry point is the **RustAdapterFactory** integration testing, which exercises:
- `createAdapter()` method with mock dependencies
- Command building through the adapter interface
- Launch configuration transformation methods
- Environment variable handling and session setup

## Internal Organization and Data Flow

1. **Test Setup Phase**: Mock dependencies are created, environment variables are configured, and test constants are established
2. **Adapter Creation**: RustAdapterFactory instantiates adapter with injected mock dependencies  
3. **Functionality Validation**: Tests verify command building, configuration transformation, and environment setup
4. **Cleanup**: Environment variables are restored to maintain test isolation

## Important Patterns and Conventions

- **Dependency Injection**: All external dependencies are mocked to enable pure integration testing
- **Platform Awareness**: Tests handle Windows vs Unix differences (binary extensions, LLDB settings)
- **Environment Isolation**: Each test manages its own environment variables with proper cleanup
- **No-Process Testing**: Tests validate adapter logic without actually launching debug processes
- **Smoke Testing Approach**: Focus on critical path validation rather than exhaustive coverage

The test suite serves as a contract validation layer, ensuring the Rust adapter maintains compatibility with the CodeLLDB debugger while handling platform-specific requirements correctly.