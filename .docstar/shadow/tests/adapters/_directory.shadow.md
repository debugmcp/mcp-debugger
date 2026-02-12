# tests/adapters/
@generated: 2026-02-11T23:48:24Z

## Overall Purpose and Responsibility

The `tests/adapters` directory serves as the comprehensive test suite for all language-specific debug adapters in the debugmcp project. This module validates the reliability, integration, and cross-platform compatibility of adapters for Go, JavaScript, Python, and Rust debugging environments. The test suite ensures proper Debug Adapter Protocol (DAP) compliance, toolchain integration, and session management across diverse development environments while maintaining complete isolation from external dependencies through sophisticated mocking strategies.

## Key Components and Integration Architecture

### Language-Specific Test Modules

**Go Adapter Tests (`go/`)**
- Comprehensive lifecycle testing of GoDebugAdapter with Delve integration
- Unit tests for adapter factory patterns, environment validation, and toolchain discovery
- Integration tests for DAP command generation and configuration management
- Mock infrastructure preventing external Go/Delve process execution while maintaining realistic behavior

**JavaScript Adapter Tests (`javascript/`)**
- Integration-focused testing for TypeScript execution via tsx runtime
- Cross-platform session management and command generation validation
- VSCode js-debug extension backend integration testing
- Platform-agnostic path handling and environment safety

**Python Adapter Tests (`python/`)**
- Dual-layer testing with isolated unit tests and full integration validation
- Python executable discovery and version detection across platforms
- Real debugpy integration with MCP protocol communication testing
- Environment preparation utilities for CI/CD pipeline compatibility

**Rust Adapter Tests (`rust/`)**
- CodeLLDB adapter integration through controlled smoke testing
- Command construction validation with platform-specific binary handling
- Configuration transformation testing with LLDB parameter management
- Sophisticated mocking for external process isolation

### Shared Testing Patterns

All adapter test modules follow consistent architectural principles:
- **Isolation-First Design**: Comprehensive mocking prevents external tool dependencies while maintaining realistic interfaces
- **Cross-Platform Validation**: Platform-aware testing with OS-specific handling for Windows, Linux, and macOS
- **Environment Safety**: Rigorous setup/teardown procedures with environment variable management
- **Integration Confidence**: Layered testing from unit validation to full workflow verification

## Public API Surface and Entry Points

### Adapter Factory Testing Interface
Each language module validates its adapter factory implementation:
- `createAdapter()` instantiation and lifecycle management
- `validate()` environment prerequisite verification
- Configuration transformation and command generation
- Platform-specific toolchain discovery and version validation

### Common Testing Utilities
- **Environment Management**: Controlled setup/teardown with proper isolation
- **Mock Infrastructure**: EventEmitter-based process simulation across all adapters
- **Configuration Validation**: Launch config transformation testing
- **Session Management**: Isolated session handling with consistent test identifiers

### Protocol Compliance Validation
- **Debug Adapter Protocol (DAP)** compliance verification
- **Model Context Protocol (MCP)** integration for Python debugging
- State transition validation (INITIALIZING → READY → CONNECTED → DISPOSED)
- Command generation and response handling testing

## Internal Organization and Data Flow

### Testing Strategy Hierarchy

1. **Foundation Layer**: Unit tests validate core utilities and component isolation
2. **Integration Layer**: Component interaction testing with realistic command generation
3. **Protocol Layer**: DAP/MCP communication validation and session lifecycle testing
4. **Platform Layer**: Cross-platform compatibility and environment-specific behavior

### Mock Infrastructure Pattern

All adapters implement consistent mocking strategies:
- **Process Isolation**: child_process.spawn mocking with EventEmitter simulation
- **File System Abstraction**: Controlled tool availability responses
- **Dependency Injection**: Factory-based mock creation for consistent test setup
- **Environment Control**: Platform-aware testing without cross-platform complexity

## Important Conventions and Standards

### Quality Assurance Patterns
- **No External Dependencies**: Complete isolation from actual toolchain installations
- **Platform-Specific Testing**: Current platform execution for reliability
- **Environment Discipline**: Comprehensive cleanup preventing test pollution
- **Integration Confidence**: Smoke testing for critical functionality without exhaustive coverage

### Toolchain Integration Standards
- **Version Requirement Enforcement**: Go ≥1.18, Python with debugpy, CodeLLDB for Rust
- **Command Generation Validation**: Proper executable paths, ports, and environment variables
- **Error Message Standards**: Human-readable diagnostics for common failure scenarios
- **Capability Detection**: Tool availability and feature support verification

### Testing Execution Patterns
- **CI-Friendly Design**: Conditional execution with `@requires-*` tags
- **Diagnostic Logging**: Extensive failure artifact collection
- **Timeout Management**: Configurable polling strategies for async operations
- **State Validation**: Event-driven testing of adapter transitions

This directory serves as the critical quality gate ensuring all language-specific debug adapters maintain reliable integration with the debugging infrastructure, providing confidence in adapter behavior across the complete debugging lifecycle while supporting diverse development environments through comprehensive cross-platform testing.