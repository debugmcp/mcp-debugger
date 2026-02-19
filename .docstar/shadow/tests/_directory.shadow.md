# tests/
@children-hash: 5c8168c498981f88
@generated: 2026-02-19T23:49:18Z

## Overall Purpose and Responsibility

The `tests` directory serves as the comprehensive testing ecosystem for the DebugMCP framework, providing multi-layered validation of AI-driven debugging capabilities through the Model Context Protocol (MCP). This testing infrastructure ensures reliable debugging functionality across multiple programming languages (JavaScript/TypeScript, Python, Rust, Go), transport mechanisms (stdio, SSE), and deployment scenarios (local, Docker, npm distribution).

## Key Components and Integration Architecture

### Multi-Tiered Testing Strategy

**Unit Testing Foundation** (`unit/`, `core/`): Comprehensive component-level validation of the debugging infrastructure, including MCP protocol compliance, session management, adapter factories, and debugging tool functionality across 19 MCP debugging tools.

**Integration Testing Layer** (`integration/`, `proxy/`): End-to-end validation of language-specific adapters, DAP proxy systems, multi-session debugging, and policy-driven session management with real debugging environments.

**End-to-End Validation** (`e2e/`, `stress/`): Complete workflow testing from session creation through execution control across all supported languages, with transport protocol validation and performance/reliability testing under extreme conditions.

**Language Adapter Testing** (`adapters/`): Specialized test suites for each programming language's debugging adapter (Go/Delve, JavaScript/js-debug, Python/debugpy, Rust/CodeLLDB) with cross-platform compatibility and environment validation.

### Testing Infrastructure Ecosystem

**Test Utilities Framework** (`test-utils/`): Comprehensive testing infrastructure providing resource management (ports, processes), dependency injection, mock factories, session tracking, and environment validation to enable isolated, reliable testing.

**Fixtures and Validation** (`fixtures/`, `validation/`): Controlled test environments with multi-language debugging targets, error scenarios, and specification-by-example validation data for systematic testing of debugging functionality.

**Implementation Mocks** (`implementations/`): Complete test doubles for process management, enabling deterministic testing of process-launching functionality without spawning actual external processes.

## Public API Surface and Entry Points

### Primary Testing Interfaces

**Language-Specific Testing**:
- `mcp-server-smoke-{language}.test.ts` - Individual language debugging workflow validation
- `comprehensive-mcp-tools.test.ts` - Matrix testing of all 19 MCP debugging tools across 5 languages
- Adapter-specific test suites in `adapters/{language}/` directories

**Transport and Protocol Testing**:
- SSE transport validation (`*-sse.test.ts` files)
- STDIO transport testing with MCP protocol compliance
- Cross-transport parity validation ensuring identical behavior

**Core System Validation**:
- MCP Debug Server testing with complete tool coverage
- Session lifecycle management and state transitions
- DAP proxy system with multi-session debugging capabilities

### Testing Utilities and Infrastructure

**Resource Management APIs**:
- `createTestDependencies()` - Comprehensive dependency injection for isolated testing
- `portManager` - Port allocation preventing test conflicts
- `processTracker` - Global process lifecycle management

**Mock and Fixture Systems**:
- Language-specific debugging targets and error scenarios
- Complete DAP client/server simulation
- Process management mocking with controllable behavior

## Internal Organization and Data Flow

### Hierarchical Testing Architecture

The testing system follows a layered validation approach:

1. **Foundation Layer**: Unit tests validate core components, utilities, and protocol compliance
2. **Integration Layer**: Component interaction testing with real debugging environments
3. **System Layer**: End-to-end workflows across transport mechanisms and languages
4. **Validation Layer**: Stress testing and cross-platform compatibility verification

### Quality Assurance Patterns

**Test Isolation Strategy**: Each test receives dedicated resources (ports, processes, sessions) with automatic cleanup to prevent interference and ensure deterministic behavior.

**Cross-Platform Validation**: Comprehensive testing across Windows, Linux, and macOS with platform-specific handling for executables, paths, and debugging tools.

**Error Resilience Testing**: Systematic validation of failure modes, missing tools, version incompatibilities, and graceful degradation scenarios.

**Performance and Reliability**: Stress testing with rapid connections, burst traffic, sustained operations, and server recovery validation.

## Framework Integration and Dependencies

### Core Testing Technologies
- **Vitest**: Primary testing framework with comprehensive mocking and assertion capabilities
- **Jest**: E2E test environment setup with TypeScript runtime compilation
- **MCP SDK**: Client libraries for protocol communication validation
- **Debug Adapter Protocol**: Standardized debugging interfaces across all language adapters

### Development and CI/CD Integration
- Environment-aware testing with configurable timeouts for CI systems
- Conditional execution for resource-intensive stress tests
- Coverage reporting and failure analysis utilities
- Docker-based testing for consistent cross-platform validation

This comprehensive testing directory ensures the DebugMCP framework provides reliable, performant, and consistent debugging capabilities across all supported programming languages, transport mechanisms, and deployment scenarios while maintaining rigorous quality standards and comprehensive error handling.