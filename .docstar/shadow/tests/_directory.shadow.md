# tests/
@children-hash: d696a7e46938f4b1
@generated: 2026-02-15T09:02:36Z

## Overall Purpose and Responsibility

The `tests` directory provides comprehensive test coverage for the entire Debug MCP (Model Context Protocol) Server ecosystem, validating debugging capabilities across multiple programming languages, transport protocols, and deployment scenarios. This test suite ensures the reliability of AI-driven debugging through the MCP protocol, covering everything from basic unit functionality to complex end-to-end debugging workflows in production-like environments.

## Key Components and System Integration

### Multi-Layered Testing Architecture

**Core System Testing (`core/`, `unit/`)**:
- Protocol contracts and Debug Adapter Protocol (DAP) implementations
- Session management and multi-session debugging coordination
- MCP server functionality exposing 19+ debugging tools to AI agents
- Dependency injection, factory patterns, and service integration
- CLI interfaces supporting STDIO and SSE transport protocols

**Language Adapter Testing (`adapters/`)**:
- Comprehensive validation of Go, JavaScript/TypeScript, Python, and Rust debugging adapters
- Cross-platform compatibility testing with unified adapter factory patterns
- Integration with language-specific debuggers (Delve, js-debug, debugpy, CodeLLDB)
- Configuration transformation and command generation for each debugging backend

**End-to-End Validation (`e2e/`, `integration/`)**:
- Complete debugging workflows from session creation through cleanup
- Multi-transport testing (STDIO, SSE) across deployment scenarios (local, Docker, NPX)
- Real debugger integration without mocking for authentic production validation
- Comprehensive matrix testing of all MCP tools across supported languages

**Infrastructure and Support Systems**:
- **Proxy System (`proxy/`)**: DAP proxy testing with multi-session support and policy-driven adapter behavior
- **Stress Testing (`stress/`)**: Transport reliability under load, rapid connections, and failure recovery
- **Test Utilities (`test-utils/`)**: Comprehensive mocking infrastructure, resource management, and test isolation
- **Validation Fixtures (`fixtures/`, `validation/`)**: Controlled test environments and debugging scenarios across all supported languages

## Public API Surface and Entry Points

### Primary Test Categories

**Core MCP Debugging API Validation**:
- Session lifecycle operations (`create_debug_session`, `list_debug_sessions`, `close_debug_session`)
- Debug control tools (`set_breakpoint`, `start_debugging`, `step_over/into/out`, `continue_execution`)
- Code inspection utilities (`get_variables`, `get_stack_trace`, `evaluate_expression`, `get_source_context`)
- Multi-language adapter integration with automatic language detection

**Transport Protocol Testing**:
- STDIO transport for process-based MCP communication
- Server-Sent Events (SSE) transport with HTTP-based client-server communication
- Docker containerization and NPX global distribution validation

**Cross-Platform Integration**:
- Windows, Linux, and macOS compatibility testing
- Container-aware path resolution and workspace management
- Platform-specific executable discovery and debugger integration

### Test Execution Entry Points

**Development Testing**:
- `npm test` - Core unit and integration test suite
- `npm run test:e2e` - End-to-end debugging workflow validation
- `npm run test:stress` - Transport reliability and performance testing

**Manual Validation** (`manual/`):
- Standalone scripts for SSE protocol debugging and Python debugger integration
- Live debugging session validation for development troubleshooting

## Internal Organization and Data Flow

### Test Execution Pipeline

1. **Environment Setup**: Resource allocation (ports, processes, sessions) with conflict prevention
2. **Component Isolation**: Comprehensive mocking of external dependencies while preserving realistic behavior
3. **Workflow Validation**: Sequential testing through complete debugging lifecycles
4. **Cross-Component Integration**: Validation of adapter → session manager → proxy → MCP server communication chains
5. **Cleanup and Resource Management**: Automated cleanup preventing test pollution and resource leaks

### Quality Assurance Strategy

**Isolation and Reliability**:
- Deterministic behavior through controlled mocking and fake timer management
- Test session correlation with unique identifiers across all components
- Resource management preventing port conflicts and process leaks

**Comprehensive Coverage**:
- Error path testing alongside happy path validation
- Edge case handling (missing tools, version incompatibilities, network failures)
- Performance validation under stress conditions with configurable thresholds

**Production Readiness**:
- Real debugger integration in E2E tests without mocking critical paths
- Container and distribution testing matching deployment scenarios
- Cross-platform compatibility validation with fallback strategies

## Critical Integration Points

### MCP Protocol Compliance
The test suite validates the complete MCP debugging experience from protocol handshakes through tool execution, ensuring AI agents can reliably perform debugging operations across all supported languages and transport mechanisms.

### Multi-Language Ecosystem
Unified testing patterns across Go, JavaScript/TypeScript, Python, and Rust ensure consistent debugging experiences while accommodating language-specific requirements and toolchain differences.

### Production Environment Simulation
From unit tests with comprehensive mocking to E2E tests with real debuggers and deployment scenarios, the test suite provides confidence that debugging functionality works reliably in production environments.

This comprehensive testing infrastructure ensures the Debug MCP Server provides robust, reliable debugging capabilities for AI agents across the entire supported ecosystem of programming languages, deployment scenarios, and operational conditions.