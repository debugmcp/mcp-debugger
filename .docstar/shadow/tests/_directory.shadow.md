# tests/
@generated: 2026-02-10T01:20:52Z

## Overall Purpose

The `tests` directory serves as the comprehensive testing infrastructure for the Debug MCP Server system, providing extensive validation coverage across all architectural layers from unit testing through end-to-end integration. This module ensures the reliability, protocol compliance, and cross-language debugging capabilities of the MCP (Model Context Protocol) debugging system through a multi-tiered testing strategy that encompasses unit tests, integration tests, stress testing, and manual validation.

## Key Components and Integration Architecture

### Multi-Layer Testing Strategy

The testing infrastructure follows a systematic validation approach across five primary dimensions:

**Core System Validation (`core/`, `unit/`)**
- Comprehensive unit testing of Debug Adapter Protocol (DAP) compliance, session management, and MCP tool interfaces
- Validates 14 debugging tools across the complete MCP protocol surface with session lifecycle management
- Tests foundational contracts between language adapters and core debugging infrastructure
- Ensures type safety, error handling, and cross-platform compatibility

**Language Adapter Testing (`adapters/`)**
- Validates debugging integration for Go (Delve), JavaScript/TypeScript (tsx/js-debug), Python (debugpy), and Rust (CodeLLDB)
- Provides standardized testing patterns for consistent adapter validation across all supported languages
- Tests environment discovery, runtime detection, and debugger capability negotiation
- Uses sophisticated mocking to prevent external process execution during testing

**End-to-End Integration (`e2e/`, `integration/`)**
- Complete workflow validation across 6 programming languages with real debugging scenarios
- Tests Docker containerization, npm distribution, and multiple transport mechanisms (stdio, SSE)
- Validates debugging operations including breakpoints, variable inspection, stack traces, and execution control
- Ensures production deployment scenarios work reliably across different environments

**Infrastructure and Reliability (`proxy/`, `stress/`, `validation/`)**
- Proxy system testing for multi-session DAP communication with policy-driven behavior
- Stress testing for transport layer reliability and cross-protocol parity validation
- Specialized validation of debugpy breakpoint messaging and Python debugging edge cases
- Performance and scalability testing under extreme operational conditions

### Supporting Infrastructure

**Test Utilities and Mocking (`test-utils/`, `implementations/`)**
- Comprehensive test fixture collection with multi-language debug targets and scenarios
- Complete process management mocking system eliminating external dependencies
- Resource management utilities for port allocation, session tracking, and cleanup
- Promise lifecycle monitoring and memory leak detection for reliable test execution

**Configuration and Setup (`vitest.setup.ts`, `jest-register.js`)**
- Global test environment configuration with cross-platform ESM support
- TypeScript runtime compilation enabling direct .ts execution in test environments
- Centralized mock management and cleanup for consistent test isolation

## Public API Surface and Entry Points

### Primary Test Execution Points
- **Individual Test Suites**: Language-specific and component-specific test files executable independently
- **Comprehensive Matrix Testing**: Full 19 MCP tools × 6 languages validation producing detailed pass/fail reports
- **Manual Testing Scripts**: Standalone validation tools for protocol compliance and integration verification
- **Stress Testing Interface**: Configurable stress testing with environment variable gating (`RUN_STRESS_TESTS`)

### Key Testing Interfaces
- **Debug Session Factory**: `createDebugSession()`, `setBreakpoint()`, `getVariables()` for integration testing
- **Mock System**: Complete dependency injection with `createTestDependencies()` and configurable behavior
- **Resource Management**: `portManager`, `processTracker` for reliable test resource coordination
- **Transport Testing**: Cross-transport validation ensuring STDIO/SSE functional parity

### Fixture and Utility APIs
- **Multi-Language Fixtures**: Standardized debug targets across JavaScript, Python, Rust, Go, and Java
- **Test Infrastructure**: Session management, resource tracking, and cleanup utilities
- **Environment Detection**: Runtime validation for required debugging toolchains and dependencies

## Internal Organization and Data Flow

### Test Execution Architecture
The testing system follows a coordinated execution pattern:

1. **Environment Setup**: Toolchain detection, resource allocation, and dependency validation
2. **Test Isolation**: Independent test execution with comprehensive mocking and cleanup
3. **Integration Validation**: Multi-component testing with real debugging workflows
4. **Stress and Edge Case Testing**: Reliability validation under extreme conditions
5. **Manual Verification**: Protocol compliance and deployment scenario validation

### Quality Assurance Patterns
- **Comprehensive Coverage**: Unit → Integration → E2E → Stress testing progression
- **Cross-Platform Validation**: Consistent behavior testing across Windows, Linux, and macOS
- **Resource Management**: Systematic cleanup preventing test interference and resource leaks
- **Mock-First Strategy**: Controllable test doubles enabling deterministic validation scenarios

### Key Testing Conventions
- **Test Isolation**: Each test operates independently with proper setup/teardown
- **Deterministic Behavior**: Predictable outcomes through comprehensive mocking and controlled environments
- **Cross-Language Consistency**: Standardized patterns enabling unified testing across language adapters
- **CI/CD Integration**: Automated validation workflows with configurable test execution

This testing directory serves as the complete quality assurance foundation for the Debug MCP Server, ensuring reliable multi-language debugging capabilities while providing comprehensive validation coverage that prevents regressions and maintains system reliability across diverse deployment scenarios and debugging workflows.