# tests/
@children-hash: 811b7428ce8d86e8
@generated: 2026-02-21T08:29:54Z

## Overall Purpose and Responsibility

The `tests` directory serves as the comprehensive testing ecosystem for the Debug MCP (Model Context Protocol) framework - a sophisticated debugging infrastructure that bridges debugging tools across multiple programming languages (Python, JavaScript/TypeScript, Rust, Go) through standardized MCP communication protocols. This directory ensures the framework maintains production-level reliability, cross-platform compatibility, and consistent debugging experiences across all supported languages and deployment scenarios.

## Key Components and Integration Architecture

### Multi-Layer Testing Hierarchy

The testing suite employs a sophisticated four-tier validation approach:

**Unit Testing Foundation (`unit/`, `core/`)**
- Complete isolation testing of individual components with comprehensive mocking
- Protocol contract validation for debug adapter interfaces and MCP compliance
- Factory pattern testing for dependency injection and session management
- Runtime safety validation with type guards and API consistency checking

**Integration Testing Layer (`integration/`, `adapters/`)**
- End-to-end language adapter testing (Go/Delve, JavaScript/js-debug, Python/debugpy, Rust/CodeLLDB)
- Real debugging workflow validation with actual language runtimes
- Cross-platform compatibility testing for Windows, Linux, and macOS
- Adapter factory and configuration transformation pipeline validation

**End-to-End Validation (`e2e/`)**
- Complete production environment testing across all transport mechanisms (stdio, SSE, Docker)
- 19×5 tool/language test matrix validating comprehensive MCP debugger functionality
- Distribution integrity testing through npm/npx package installation
- Real-world debugging scenario validation with containerized environments

**Specialized Testing Modules**
- **Stress Testing (`stress/`)**: Transport layer reliability under extreme load conditions
- **Manual Testing (`manual/`)**: Interactive protocol validation and SSE connection testing
- **Validation Testing (`validation/`)**: Breakpoint message functionality and debugpy behavior validation

### Component Coordination Flow

The testing architecture follows a systematic integration pattern:

1. **Foundation Layer**: Core protocol contracts and utility functions establish the testing baseline
2. **Adapter Layer**: Language-specific debugging capabilities are validated with both mocked and real dependencies  
3. **Session Layer**: Multi-session debugging workflows are tested through the proxy system and session management
4. **Transport Layer**: MCP communication protocols are validated across stdio, SSE, and containerized deployments
5. **Integration Layer**: Complete debugging workflows are validated in production-like environments

## Public API Surface and Entry Points

### Primary Test Execution Points

**Comprehensive Test Suites**
- `comprehensive-mcp-tools.test.ts`: Master 95-scenario test matrix covering all MCP tools across all supported languages
- Language-specific smoke tests: `mcp-server-smoke-{python,javascript,rust,go}.test.ts` 
- Transport-specific validation: `mcp-server-smoke-{sse,javascript-sse}.test.ts`

**Component Testing Entry Points**
- `DebugMcpServer` integration testing with complete tool execution validation
- `SessionManager` lifecycle and state management testing  
- Adapter factory testing with environment validation and feature support
- DAP proxy system testing with multi-session debugging capabilities

**Infrastructure Testing APIs**
- Cross-transport parity validation ensuring identical behavior across communication methods
- Stress testing utilities for load testing and failure recovery scenarios
- Mock infrastructure providing deterministic test environments without external dependencies

### Testing Utilities and Support Systems

**Test Infrastructure (`test-utils/`)**
- Port management preventing test conflicts with dedicated allocation ranges
- Promise tracking for memory leak detection across test sessions
- Mock factories providing type-safe test doubles for all system components
- Environment detection for Python interpreter and debugpy availability

**Test Fixtures and Data (`fixtures/`, `validation/`)**
- Multi-language debugging targets with predictable execution paths and breakpoint opportunities
- Mock DAP server implementations for protocol testing without external dependencies
- Comprehensive Python debugging scenarios including error conditions and edge cases

## Internal Organization and Data Flow

### Testing Strategy Patterns

**Isolation-First Architecture**: All components are tested with comprehensive mocking before integration testing with real dependencies, ensuring both component reliability and system-level functionality.

**Cross-Platform Design**: Consistent handling of platform differences including executable discovery, path normalization, and environment-specific debugging tool integration.

**Progressive Complexity**: Testing progresses from simple unit validation through complex integration scenarios to complete production environment validation.

### Quality Assurance Flow

The testing system validates the complete debugging workflow:

```
Test Input → Mock/Real Dependencies → MCP Protocol → Debug Adapters → Language Runtimes → Validation
```

**Resource Management Pipeline**:
1. Test setup with isolated environments and dedicated resources
2. Component validation through mocked or controlled real dependencies  
3. Integration testing with production-like configurations
4. End-to-end validation in containerized and distributed environments
5. Systematic cleanup preventing resource leaks and test pollution

## Framework Integration and Dependencies

### Core Testing Technologies
- **Vitest**: Primary testing framework with comprehensive mocking and async support
- **Jest**: Secondary framework for specific E2E scenarios with TypeScript integration
- **MCP SDK**: Protocol communication testing and client-server validation
- **Docker**: Containerized testing for cross-platform validation and isolation

### Language-Specific Integration
- **Multi-Language Adapter Support**: Comprehensive testing of Go, JavaScript/TypeScript, Python, and Rust debugging capabilities
- **Debug Protocol Validation**: Complete DAP (Debug Adapter Protocol) compliance testing
- **Transport Layer Testing**: Validation across stdio, Server-Sent Events, and containerized communication methods

This comprehensive testing directory ensures the Debug MCP framework provides reliable, consistent, and high-performance debugging capabilities across all supported programming languages while maintaining strict quality standards through systematic validation at every architectural layer.