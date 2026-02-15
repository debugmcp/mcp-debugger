# tests\integration/
@children-hash: 38233963cc914f6c
@generated: 2026-02-15T09:01:32Z

## Purpose
Integration testing directory that validates end-to-end functionality of the debugging system, with current focus on Rust language debugging capabilities. This module serves as the final validation layer ensuring that debugging adapters work correctly in production-like scenarios with real dependencies and file system interactions.

## Key Components
- **rust/**: Comprehensive Rust debugging integration test suite that validates the complete workflow from session creation through cleanup
- **Test Infrastructure**: Production-grade dependency injection setup with isolated environments and comprehensive error handling
- **Sequential Test Patterns**: Structured test flows that maintain state across test scenarios to validate complete debugging lifecycles

## Public API Surface
The integration tests validate the following system capabilities:
- **Debug Session Management**: Creation, configuration, and termination of debugging sessions
- **Language-Specific Adapters**: Rust debugging adapter functionality with Cargo project support
- **Breakpoint Operations**: Setting and managing breakpoints across different file scenarios
- **Project Detection**: Language-specific project validation and configuration
- **Resource Lifecycle**: Proper setup, execution, and cleanup of debugging resources

## Internal Organization & Data Flow
Integration tests follow a hierarchical structure organized by language:
1. **Environment Isolation**: Each test suite creates isolated temporary directories and logging
2. **Dependency Injection**: Uses production dependency container for realistic testing scenarios  
3. **Sequential Validation**: Tests progress through debugging workflow stages maintaining shared state
4. **Error Resilience**: Graceful handling of missing files and optional scenarios
5. **Resource Cleanup**: Comprehensive teardown ensuring no test pollution

## Integration Points
- **SessionManager**: Core orchestration component for debug session lifecycle
- **File System**: Validates against example projects and handles missing file scenarios
- **Logging Infrastructure**: Integrates with temporary logging for test isolation
- **DAP Configuration**: Tests Debug Adapter Protocol settings and capabilities
- **Language Detection**: Validates project type identification and adapter selection

## Testing Patterns & Conventions
- **Production Dependencies**: Uses real dependency injection rather than mocks for authentic validation
- **State Management**: Sequential tests share context through maintained session identifiers
- **Async Operations**: Comprehensive async/await patterns with proper error propagation
- **Graceful Degradation**: Optional test scenarios handle missing resources without failing entire suite
- **Isolation Strategy**: Temporary directories and log files prevent cross-test interference

This directory ensures that debugging functionality works correctly in real-world scenarios, providing confidence that individual unit tests translate to working end-to-end debugging experiences.