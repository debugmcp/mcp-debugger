# tests/integration/
@generated: 2026-02-10T01:19:48Z

## Purpose
Comprehensive integration testing suite for validating end-to-end debugging functionality across multiple programming languages within the debugging adapter system. This directory serves as the primary validation layer for real-world debugging scenarios, ensuring the system works correctly with actual development workflows.

## Key Components
- **rust/**: Complete Rust debugging integration test suite covering session lifecycle, breakpoint management, and Cargo project integration
- Additional language-specific test suites (structure suggests support for multiple language adapters)

## Testing Architecture
### Framework & Infrastructure
- Built on modern **vitest** testing framework for async test execution
- Integrates with production dependency injection container for realistic testing
- Uses temporary directories and dedicated log files for test isolation
- Employs actual production SessionManager and debugging components

### Test Isolation Strategy
- Temporary file system resources prevent test interference
- Dedicated debug-level logging for test observation
- Graceful error handling for missing example projects
- Sequential state management through shared session identifiers

## Integration Points
### Core System Integration
- **SessionManager**: Primary orchestration point for debugging session management
- **Production Dependencies**: Uses actual production dependency container rather than mocks
- **Language Adapters**: Validates language-specific debugging capabilities and detection
- **File System**: References example projects in standardized locations (`examples/{language}/`)

### Configuration Management
- Realistic DAP (Debug Adapter Protocol) settings including stop-on-entry and just-my-code debugging
- Language-specific configuration validation
- Project workspace handling (e.g., Cargo for Rust)

## Test Coverage Areas
### Session Lifecycle
- Debug session creation, retrieval, and proper cleanup
- Resource management and teardown validation
- State persistence across test scenarios

### Language-Specific Features
- Breakpoint operations with comprehensive error handling
- Language detection and adapter selection
- Project structure recognition (build systems, workspaces)
- Source file mapping and navigation

### Error Handling & Resilience
- Graceful degradation when test resources are unavailable
- Validation of error scenarios and edge cases
- Recovery from failed debugging operations

## Public API Surface
### Test Entry Points
- Language-specific integration test suites (e.g., `rust-integration.test.ts`)
- Standardized test patterns for adding new language support
- Shared utilities for debugging session management

### Test Flow Patterns
- Sequential workflow testing that mirrors real user debugging sessions
- State-dependent test scenarios building on previous operations
- Comprehensive validation of debug adapter protocol compliance

## Internal Organization
### Data Flow
1. **Setup**: Production dependency container initialization and temporary resource creation
2. **Execution**: Sequential debugging operations maintaining session state
3. **Validation**: Comprehensive assertion coverage for each debugging capability
4. **Cleanup**: Proper resource teardown and temporary file removal

### Conventions
- Language-specific subdirectories for organized test separation
- Standardized example project locations for consistent test data
- Shared session management patterns across language adapters
- Consistent error handling and logging practices

This integration testing directory ensures the debugging system functions correctly in real-world scenarios while providing a reliable foundation for adding support for additional programming languages and debugging features.