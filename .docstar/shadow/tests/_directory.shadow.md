# tests/
@generated: 2026-02-09T18:17:38Z

## Overall Purpose and Responsibility

The `tests` directory serves as the comprehensive testing framework and quality assurance foundation for the DebugMCP system - a Model Context Protocol (MCP) implementation providing AI-accessible debugging tools across multiple programming languages. This module validates the complete debugging ecosystem from low-level DAP protocol handling to high-level MCP tool integration, ensuring reliable debugging functionality across Python, JavaScript, TypeScript, Rust, Go, and Java environments.

The directory orchestrates testing at every architectural layer: unit testing of individual components, integration testing of cross-component workflows, end-to-end validation of complete debugging scenarios, stress testing for production reliability, and manual testing utilities for development workflows.

## Component Architecture and Integration

### Multi-Layer Testing Strategy
The testing architecture mirrors the production system structure with comprehensive validation at each layer:

- **Unit Testing Foundation** (`unit/`): Isolated component testing with extensive mocking covering CLI handlers, debug adapters, session management, DAP protocol handling, and container infrastructure
- **Integration Testing** (`integration/`): Cross-component validation testing debug session lifecycles with real adapters and language toolchains
- **End-to-End Validation** (`e2e/`): Complete workflow testing from MCP client connection through debug session management to protocol communication across all supported languages
- **Adapter Ecosystem Testing** (`adapters/`): Comprehensive validation of language-specific debug adapters (Go, JavaScript, Python, Rust) with toolchain integration and cross-platform compatibility

### Core Infrastructure Components
- **Test Utilities Framework** (`test-utils/`): Centralized testing infrastructure providing resource management, mock implementations, session tracking, and cleanup coordination
- **Mock Infrastructure** (`implementations/`): Complete fake implementations of all process-related interfaces for deterministic unit testing
- **Test Fixtures** (`fixtures/`): Controlled debugging scenarios and minimal test programs across multiple programming languages
- **Validation Suites** (`validation/`): Specialized validation for debugpy breakpoint message handling and protocol compliance

### Supporting Components
- **Stress Testing** (`stress/`): Transport reliability validation and cross-transport parity testing under extreme conditions  
- **Manual Testing** (`manual/`): Development utilities for diagnosing transport protocols, debugger integrations, and connection handling
- **Proxy System Testing** (`proxy/`): Comprehensive validation of the DAP proxy system enabling multi-target debugging and adapter abstraction

## Public API Surface and Key Entry Points

### Primary Testing Entry Points
- **Test Framework Bootstrap**: `jest-register.js` configures TypeScript transpilation for E2E testing, `vitest.setup.ts` provides global test environment configuration
- **Integration Test Scripts**: `mcp_debug_test.js` exercises complete MCP debugging workflows simulating AI interaction patterns
- **Language-Specific Test Suites**: Dedicated test files for each supported language with standardized debugging workflow validation

### Core Testing Infrastructure API
- **Resource Management**: `portManager` singleton for port allocation, `testPortManager` global for test isolation, promise tracking for leak detection
- **Mock Ecosystem**: Comprehensive factories for creating mock dependencies, test servers, and session managers with configurable overrides
- **Test Utilities**: Session management utilities, environment detection, fixture management, and specialized test runners

### Test Orchestration Interface
- **Session Lifecycle Testing**: Debug session creation, configuration, breakpoint management, variable inspection, and cleanup validation
- **Protocol Compliance**: DAP message handling, MCP tool validation, transport layer testing (STDIO, SSE)
- **Cross-Platform Validation**: Container-aware testing, environment detection, and platform-specific behavior validation

## Internal Organization and Data Flow

### Testing Execution Flow
The testing system follows a structured progression from isolated unit tests through comprehensive system validation:

1. **Unit Testing Layer**: Component isolation with comprehensive mocking → Interface contract validation → Error condition coverage
2. **Integration Layer**: Cross-component interaction → Language toolchain integration → Session lifecycle management
3. **End-to-End Layer**: Complete MCP debugging workflows → Multi-language scenario validation → Transport protocol testing
4. **Quality Assurance**: Stress testing under load → Cross-transport parity validation → Manual diagnostic utilities

### Resource Management Architecture
- **Test Isolation**: Session-based tracking prevents test interference, port allocation prevents conflicts, process tracking ensures cleanup
- **Environment Configuration**: Container detection, language runtime discovery, dependency validation
- **Mock Strategy**: Comprehensive fakes maintaining interface compatibility while providing deterministic behavior

### Data Flow Patterns
Tests validate the complete debugging pipeline: **MCP Tool Invocation** → **Parameter Validation** → **SessionManager Operations** → **DAP Protocol Communication** → **Debug Adapter Interaction** → **Language Toolchain Integration** → **Response Formatting** → **MCP Tool Response**

## Important Patterns and Conventions

### Quality Assurance Standards
- **Zero Side Effects**: All external dependencies mocked for deterministic testing without system impact
- **Cross-Platform Reliability**: Platform-aware testing with proper path normalization and executable discovery
- **Resource Leak Prevention**: Comprehensive cleanup hooks and resource tracking preventing test contamination
- **Protocol Compliance**: Strict adherence to DAP specification and MCP tool interface requirements

### Testing Philosophy
- **Production Fidelity**: Integration and E2E tests use real language toolchains and dependencies when available
- **Graceful Degradation**: Tests skip appropriately when required tools are unavailable rather than failing
- **Comprehensive Coverage**: Both positive and negative testing scenarios with extensive error condition validation
- **Documentation Through Testing**: Tests serve as living specification of expected system behavior

This comprehensive testing directory ensures the DebugMCP system maintains reliability, protocol compliance, and cross-platform compatibility while providing AI agents with robust debugging capabilities across diverse development environments. The multi-layered approach validates everything from individual component correctness to complete system integration, providing confidence for production deployment and AI-driven debugging scenarios.