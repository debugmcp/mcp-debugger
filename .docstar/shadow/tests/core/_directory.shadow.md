# tests/core/
@generated: 2026-02-10T21:27:18Z

## Overall Purpose and Responsibility

The `tests/core` directory contains the complete unit testing infrastructure for DebugMCP's core debugging system. This test suite provides comprehensive coverage of the foundational components that enable AI-driven debugging through the Model Context Protocol (MCP), ensuring the system's reliability, type safety, and protocol compliance across multiple programming languages and development environments.

## Key Components and Integration

### Comprehensive Testing Architecture
The directory is organized into five primary testing domains that mirror the core system architecture:

- **Adapter Interface Testing (`unit/adapters/`)**: Validates the Debug Adapter Protocol (DAP) foundation with 40+ interface tests, ensuring type safety and protocol compliance across language-specific debugging configurations
- **Factory Pattern Validation (`unit/factories/`)**: Tests dependency injection infrastructure including `ProxyManagerFactory` and `SessionStoreFactory`, providing isolated component creation with comprehensive mock frameworks
- **MCP Server Testing (`unit/server/`)**: Validates the complete MCP protocol integration with 14 debugging tools, covering session management, execution control, and runtime inspection capabilities
- **Session Management Testing (`unit/session/`)**: Comprehensive lifecycle testing from session creation through termination, including DAP operations, multi-session coordination, and error recovery mechanisms
- **System Utilities Testing (`unit/utils/`)**: Validates cross-platform compatibility, API migration patterns, and runtime type safety across critical system boundaries

### Component Interaction and Data Flow
The test architecture follows a layered validation approach:

1. **Foundation Layer**: Type system and protocol compliance testing ensures all interfaces meet DAP specifications
2. **Component Layer**: Individual class and factory testing with comprehensive mock dependency injection
3. **Integration Layer**: End-to-end workflow validation ensuring proper component interaction across the debugging pipeline
4. **System Layer**: Cross-platform compatibility and performance validation under production-like conditions

## Public API Surface and Entry Points

### Primary Testing Interfaces
- **Mock Factories**: Centralized dependency injection containers providing consistent mock implementations across all test suites
- **Test Utilities**: Shared cross-platform helpers for path handling, async testing patterns, and mock creation
- **Validation Framework**: Runtime type guards, serialization integrity checks, and comprehensive error scenario testing

### Quality Assurance Infrastructure
- **Memory Safety Testing**: Event listener cleanup validation and resource leak prevention across session lifecycles
- **Protocol Compliance Testing**: Complete DAP specification adherence validation for all debugging operations
- **Cross-Platform Testing**: Windows/Unix compatibility verification for executable resolution and path handling
- **Performance Testing**: Large dataset handling and scalability validation for production environments

## Internal Organization and Testing Methodology

### Test Execution Strategy
The test suite employs a "Foundation First" approach, validating core type safety and protocol compliance before testing higher-level integrations. This ensures that foundational issues are caught early in the testing pipeline while maintaining comprehensive coverage of complex multi-component workflows.

### Mock and Isolation Patterns
- **Complete Dependency Mocking**: File system, network, and external adapter dependencies are systematically mocked for test isolation
- **Fake Timer Management**: Consistent async behavior testing using Vitest fake timers for deterministic test execution
- **State Isolation**: Each test maintains complete isolation with systematic cleanup to prevent cross-test contamination

### Quality Gates
The testing infrastructure enforces multiple quality checkpoints:
- TypeScript compilation verification combined with runtime type guard validation
- DAP protocol specification compliance across all debugging operations
- Memory safety validation with event listener accumulation prevention
- API evolution testing ensuring smooth migration of legacy interfaces

## System Validation Scope

This unit test directory validates the complete DebugMCP debugging stack from MCP protocol handling through language-specific adapter integration. The test coverage ensures that AI agents can reliably create, manage, and interact with debugging sessions across multiple programming languages while maintaining type safety, protocol compliance, and robust error handling throughout the debugging lifecycle.