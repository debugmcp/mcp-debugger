# tests\adapters/
@generated: 2026-02-12T21:06:30Z

## Purpose and Responsibility

The `tests/adapters` directory provides comprehensive test coverage for all debug adapter implementations, ensuring reliable Debug Adapter Protocol (DAP) compliance and proper integration with language-specific debugging toolchains. This module serves as the central quality assurance gateway for the debug adapter ecosystem, validating adapter functionality from individual component behavior to complete end-to-end debugging workflows.

## Overall Architecture and Testing Strategy

The testing suite employs a **multi-tier validation approach** consistent across all language adapters:

### Two-Layer Testing Pattern
- **Unit Testing Layer**: Deep validation of individual components with comprehensive mocking of external dependencies, focusing on internal logic and API contracts
- **Integration Testing Layer**: End-to-end smoke tests validating complete adapter pipelines using controlled environments without heavy external process dependencies

### Cross-Platform Compatibility Framework
All adapter test suites implement robust cross-platform testing infrastructure:
- Platform-aware executable discovery and path resolution
- Environment variable management and isolation
- Windows/Unix-specific behavior validation
- CI environment compatibility (especially GitHub Actions)

## Key Components and Relationships

### Language-Specific Adapter Test Suites

**Go Adapter Tests** (`go/`):
- Comprehensive validation of Go + Delve integration
- Mock-based unit testing with EventEmitter-based process simulation
- Integration smoke tests for DAP command building and configuration transformation
- Tool compatibility validation (Go 1.18+, Delve with DAP support)

**JavaScript/TypeScript Adapter Tests** (`javascript/`):
- Integration-focused testing emphasizing real adapter factory interaction
- Session management and registry integration validation
- TypeScript runtime detection with tsx fallback support
- Debug server command construction and execution preparation

**Python Adapter Tests** (`python/`):
- Dual-strategy approach: sophisticated mocking for units, real implementations for integration
- Python environment discovery across diverse deployment scenarios
- MCP (Model Context Protocol) communication testing for debug workflows
- Special emphasis on Windows CI environment challenges and Microsoft Store alias handling

**Rust Adapter Tests** (`rust/`):
- CodeLLDB integration validation through mock dependency frameworks
- Platform-specific binary handling and environment configuration
- Launch configuration transformation and command generation testing
- Smoke testing approach avoiding actual debugging process spawning

### Shared Testing Infrastructure

All adapter test suites leverage common patterns:
- **Mock Dependency Injection**: Consistent factory patterns for test doubles across process spawning, file system operations, and environment management
- **Session Lifecycle Management**: Standardized adapter state transition validation (UNINITIALIZED → READY → CONNECTED → DISCONNECTED)
- **Environment Isolation**: Systematic preservation and restoration of system state between test runs

## Public API Surface

### Primary Entry Points
- **Adapter Factory Testing**: Validation of language-specific factory implementations, metadata reporting, and environment compatibility
- **Debug Session Management**: Lifecycle testing from initialization through disposal with proper state management
- **Configuration Transformation**: Testing of launch config processing, path resolution, and platform normalization
- **Tool Discovery and Validation**: Cross-platform executable detection and version compatibility verification

### Core Testing Capabilities
- **DAP Protocol Compliance**: Validation of Debug Adapter Protocol implementation correctness
- **Command Generation**: Testing of language-specific debugger command construction (dlv, node --inspect, debugpy, CodeLLDB)
- **Cross-Platform Compatibility**: Ensuring consistent behavior across Windows, Linux, and macOS environments
- **Error Handling**: Comprehensive failure mode testing and graceful degradation validation

## Internal Organization and Data Flow

### Test Execution Pipeline
1. **Environment Setup**: System state preservation, mock dependency initialization, adapter registry configuration
2. **Component Validation**: Factory registration, configuration transformation, command building verification
3. **Integration Testing**: End-to-end workflow validation through controlled environments
4. **Cleanup and Isolation**: State restoration, registry clearing, mock cleanup

### Quality Assurance Patterns
- **Smoke Testing Philosophy**: Focus on critical integration points rather than exhaustive edge case coverage
- **Real vs Mock Strategy**: Strategic balance between mock-based isolation and real implementation validation
- **CI-First Design**: Special attention to GitHub Actions, container environments, and automated testing scenarios
- **Platform Matrix Testing**: Comprehensive coverage across operating systems and runtime configurations

## Dependencies and Integration Points

### Testing Framework Integration
- **Vitest**: Primary testing framework with extended timeouts for integration scenarios
- **Mock Infrastructure**: Sophisticated process, filesystem, and environment mocking capabilities
- **MCP SDK**: Model Context Protocol integration for Python adapter communication testing

### Runtime Dependencies
- **Language Toolchain Integration**: Real tool discovery and version validation (Go, Node.js, Python, Rust)
- **Debug Protocol Libraries**: VS Code Debug Protocol types and DAP specification compliance
- **Cross-Platform Utilities**: Path handling, environment management, and executable discovery across platforms

This test directory ensures the debug adapter ecosystem maintains high reliability, proper protocol compliance, and consistent cross-platform behavior while providing comprehensive validation coverage from individual component testing to complete debugging workflow integration.