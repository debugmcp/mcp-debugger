# tests/
@children-hash: 17774bf2aab04a62
@generated: 2026-02-24T01:56:17Z

## Overall Purpose and Responsibility

The `tests` directory provides comprehensive test coverage for the MCP (Model Context Protocol) debugger system, ensuring reliable debugging functionality across multiple programming languages (Python, JavaScript/TypeScript, Rust, Go), transport mechanisms (stdio, SSE), and deployment environments (local, Docker, NPM). This directory serves as the complete quality assurance foundation, validating everything from core protocol implementation to end-to-end debugging workflows.

## Test Architecture and Component Integration

The testing infrastructure follows a **layered validation approach** with five distinct testing tiers that work together:

### Core Foundation Layer (`core/`, `unit/`)
- **Protocol Contract Testing**: Validates debug adapter interfaces, MCP tool implementations, and type safety across the system
- **Component Unit Testing**: Comprehensive testing of SessionManager, DebugMcpServer, dependency injection containers, and utility functions
- **Mock Infrastructure**: Extensive fake implementations and dependency injection for isolated testing

### Language Adapter Layer (`adapters/`, `implementations/`)
- **Cross-Platform Adapter Testing**: Validates Go (Delve), JavaScript (js-debug), Python (debugpy), and Rust (CodeLLDB) adapter integrations
- **Process Management Testing**: Complete fake process implementations enabling deterministic testing of external tool interactions
- **Environment Discovery**: Tests runtime detection and toolchain compatibility across platforms

### Integration & E2E Layer (`integration/`, `e2e/`)
- **End-to-End Workflows**: Complete debugging session validation from creation through breakpoint management to cleanup
- **Multi-Transport Testing**: Validates identical behavior across stdio and Server-Sent Events transport mechanisms
- **Real Environment Testing**: Docker containerized testing and NPM package distribution validation

### Specialized Testing (`proxy/`, `stress/`, `manual/`)
- **DAP Proxy System**: Multi-session debugging coordination, adapter-specific policies, and command routing validation
- **Performance & Reliability**: Stress testing for transport layer resilience, load handling, and failure recovery
- **Developer Tools**: Manual testing scripts for SSE connectivity and protocol debugging

### Test Infrastructure (`test-utils/`, `fixtures/`)
- **Shared Testing Utilities**: Port management, process tracking, mock factories, and resource cleanup
- **Test Fixtures**: Language-specific debugging targets, mock servers, and predictable code samples
- **Validation Framework**: Test data and scenarios for systematic debugging behavior verification

## Public API Surface and Entry Points

### Primary Test Execution Points
- **Language-Specific Smoke Tests**: `e2e/mcp-server-smoke-{language}.test.ts` for complete workflow validation
- **Comprehensive Tool Testing**: `e2e/comprehensive-mcp-tools.test.ts` validates all 19 MCP tools across 5 languages
- **Unit Test Suites**: `unit/` directory provides component-level validation with extensive mocking
- **Integration Testing**: `integration/` validates production environment behavior with real dependencies

### Cross-Cutting Validation Capabilities
- **Multi-Environment Testing**: Local development, Docker containers, and NPM global installation scenarios
- **Transport Protocol Validation**: STDIO and Server-Sent Events with parity and stress testing
- **Cross-Platform Compatibility**: Windows, Linux, and macOS support with platform-specific handling
- **Error Scenario Testing**: Comprehensive failure mode validation and graceful degradation testing

## Internal Organization and Data Flow

### Test Execution Hierarchy
The testing system follows a **bottom-up validation approach**:

1. **Foundation Validation**: Protocol contracts and core component behavior
2. **Component Integration**: Language adapters and process management coordination  
3. **System Integration**: Complete debugging workflows with real dependencies
4. **Environment Validation**: Cross-platform, multi-transport, and deployment scenario testing
5. **Performance Validation**: Stress testing and reliability under adverse conditions

### Resource Management and Isolation
- **Singleton Resource Management**: Global port allocation and process tracking prevent test conflicts
- **Comprehensive Cleanup**: Automated resource deallocation and state reset between tests
- **Mock Ecosystem**: Layered mock implementations from system interfaces to application services
- **Session-Based Tracking**: Unique session IDs correlate resources across promise tracking and debugging utilities

### Quality Assurance Patterns
- **Test-First Development**: Mock implementations define expected interfaces before production code
- **Defensive Testing**: Extensive error injection and edge case validation
- **Cross-Reference Validation**: Same functionality tested at multiple levels (unit, integration, e2e)
- **Environment-Agnostic Design**: Tests run reliably across different development and CI environments

This comprehensive testing directory ensures the MCP debugger system maintains high reliability, consistent behavior, and robust error handling across all supported programming languages, deployment scenarios, and operational conditions through systematic automated validation at every architectural layer.