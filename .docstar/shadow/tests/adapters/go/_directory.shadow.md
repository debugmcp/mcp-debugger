# tests/adapters/go/
@generated: 2026-02-11T23:47:58Z

## Overall Purpose and Responsibility

The `tests/adapters/go` directory provides comprehensive test coverage for the Go debugger adapter, ensuring reliable integration between the debug framework and Go/Delve toolchain. This test suite validates the complete lifecycle of Go debugging sessions, from environment validation and adapter instantiation through Debug Adapter Protocol (DAP) communication and session management.

## Key Components and Integration

### Test Architecture Organization

**Unit Tests (`unit/`)**
- **Core Adapter Testing**: Complete lifecycle validation of GoDebugAdapter state management (INITIALIZING → READY → CONNECTED → DISPOSED)
- **Factory Pattern Testing**: GoAdapterFactory creation, validation, and metadata exposure
- **Utility Functions Testing**: Tool discovery, version parsing, and platform-specific path resolution
- **Environment Validation**: Go (≥1.18) and Delve installation requirement verification

**Integration Tests (`integration/`)**
- **End-to-End Validation**: Smoke tests for complete adapter functionality without launching actual debugger processes
- **Command Generation Testing**: Validation of dlv DAP command construction and configuration
- **Configuration Management**: Testing of launch config transformations for both normal programs and test mode
- **Mock Integration**: Sophisticated mocking system that maintains realistic behavior while preventing external dependencies

### Component Relationships

The test components work together in a layered validation approach:
1. **Unit tests** validate individual components in isolation with comprehensive mocking
2. **Integration tests** verify component interactions and realistic command generation
3. **Shared mock infrastructure** provides consistent test environments across both layers
4. **Common validation patterns** ensure consistent testing of Go toolchain requirements

## Public API Surface Validation

### Primary Entry Points Tested
- **GoAdapterFactory.createAdapter()**: Factory instantiation and adapter creation
- **GoAdapterFactory.validate()**: Environment prerequisite validation
- **GoDebugAdapter lifecycle methods**: initialize(), dispose(), connect(), disconnect()
- **Configuration transformation**: transformLaunchConfig() for debug and test modes
- **Utility functions**: Tool discovery, version parsing, DAP support detection

### Test Configuration Interfaces
- Standard test runners (vitest) for both unit and integration execution
- Mock adapter factories for isolated testing scenarios
- Environment configuration utilities for controlled test setup
- Consistent test ports (48766) and session identifiers for network testing

## Internal Organization and Data Flow

### Testing Strategy
1. **Isolation Phase**: Mock dependencies prevent external tool execution while maintaining realistic interfaces
2. **Environment Control**: Platform-aware testing with careful environment variable management and cleanup
3. **State Validation**: Event-driven testing of adapter state transitions and capability negotiation
4. **Integration Verification**: Command generation and configuration validation without actual debugger launches

### Mock Infrastructure Patterns
- **Process Isolation**: child_process.spawn mocking with EventEmitter simulation
- **File System Abstraction**: Controlled fs.promises.access responses for tool availability
- **Platform Abstraction**: Current platform testing to avoid cross-platform complexity
- **Dependency Injection**: createMockDependencies() factory for consistent test setup

## Important Testing Conventions

### Cross-Platform Considerations
- Tests execute only on current platform for reliability
- Platform-specific tool discovery validation (GOPATH/GOBIN support)
- Windows/Unix path handling verification

### Environment Safety
- Comprehensive environment variable cleanup to prevent test pollution
- Careful mock lifecycle management with setup/teardown isolation
- Real vs. fake tool path management for testing without installation requirements

### Validation Standards
- DAP protocol compliance verification
- Go toolchain version requirement enforcement (≥1.18)
- Delve Debug Adapter Protocol capability detection
- Human-readable error message generation for common failure scenarios

This directory serves as the comprehensive testing gateway for Go debug adapter functionality, ensuring reliable operation across diverse development environments while maintaining complete isolation from external Go/Delve installations and providing confidence in adapter behavior across the full debugging lifecycle.