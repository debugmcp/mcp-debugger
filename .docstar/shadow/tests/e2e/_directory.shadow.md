# tests/e2e/
@generated: 2026-02-10T01:20:08Z

## E2E Testing Framework for MCP Debugger

**Overall Purpose:** Comprehensive end-to-end test suite validating the MCP (Model Context Protocol) debugger across all supported programming languages, deployment scenarios, and integration patterns. This testing framework ensures debugging functionality works reliably in production environments including containerized deployments, npm distribution, and various transport mechanisms (stdio, SSE).

### Key Components and Architecture

#### Core Test Infrastructure
- **Test Utilities (`smoke-test-utils.ts`)**: Central utility module providing MCP client abstractions, Docker management, debug session orchestration, and result parsing
- **Event Management (`test-event-utils.ts`)**: Intelligent polling mechanisms for debug session state changes with timeout handling and event recording
- **Language Support (`rust-example-utils.ts`)**: Cross-platform Rust compilation utilities with Docker-based Linux builds and smart caching

#### Multi-Language Test Matrix
The testing framework validates debugging across 6 language adapters with comprehensive coverage:

**Language-Specific Smoke Tests:**
- `mcp-server-smoke-javascript.test.ts`: JavaScript debugging via Node.js with DAP integration
- `mcp-server-smoke-python.test.ts`: Python debugging with debugpy backend validation
- `mcp-server-smoke-rust.test.ts`: Rust debugging including async patterns and variable inspection
- `mcp-server-smoke-go.test.ts`: Go debugging with Delve integration
- `mcp-server-smoke-java.test.ts`: Java debugging using jdb with absolute path requirements

**Comprehensive Matrix Testing:**
- `comprehensive-mcp-tools.test.ts`: 19 MCP tools × 6 languages matrix validation producing detailed PASS/FAIL/SKIP reports

### Public API Surface

#### Main Entry Points
- **Individual Smoke Tests**: Language-specific test suites that can be run independently for targeted validation
- **Comprehensive Suite**: Full matrix testing for CI/CD pipeline validation
- **Docker Tests (`docker/`)**: Containerized environment validation with path translation and volume management
- **NPX Tests (`npx/`)**: npm distribution validation testing global installation and execution pathways

#### Key Testing Patterns
- **Session Lifecycle**: Create → Configure → Execute → Cleanup pattern across all tests
- **Error Resilience**: Graceful handling of missing toolchains, connection failures, and timing issues
- **Transport Validation**: stdio, SSE, and Docker transport mechanisms
- **Real-world Scenarios**: Actual debugging workflows with breakpoints, variable inspection, and execution control

### Internal Organization and Data Flow

#### Test Execution Flow
1. **Environment Validation**: Check for required language toolchains and Docker availability
2. **MCP Server Initialization**: Launch debug server with appropriate transport (stdio/SSE)
3. **Debug Session Management**: Create language-specific debug sessions with proper cleanup
4. **Debugging Operations**: Execute complete workflows including breakpoints, stepping, variable inspection
5. **Result Collection**: Aggregate results for reporting and CI/CD integration

#### Critical Integration Points

**Transport Layer Testing:**
- `mcp-server-smoke-javascript-sse.test.ts`: Validates SSE transport with console silencing fix
- `debugpy-connection.test.ts`: Tests Python debugpy integration with process management
- `mcp-server-java-attach.test.ts`: Java JDWP attachment scenarios without process termination

**Distribution Validation:**
- **Docker Tests**: Validate containerized deployment with proper volume mounts and path translation
- **NPX Tests**: Ensure npm package distribution works with global installation and execution

**Language Adapter Loading:**
- Tests adapter discovery and initialization through `AdapterLoader` system
- Validates language-specific debugging characteristics (absolute paths for Java, expression-only evaluation for Python)

### Important Patterns and Conventions

#### Resource Management
- Comprehensive cleanup in `afterAll`/`afterEach` hooks preventing resource leaks
- Process-safe concurrency controls for Docker and npm operations
- Graceful shutdown sequences with SIGTERM → SIGKILL fallback patterns

#### Timing and Reliability
- Configurable timeouts with environment-based scaling (`TIMEOUT_MULTIPLIER`)
- Retry mechanisms for timing-sensitive operations (stack trace availability, port binding)
- Strategic wait periods for async debugging operations and process synchronization

#### Cross-Platform Compatibility
- Docker volume path normalization for Windows/Unix differences
- Platform-specific executable detection (python vs python3, Windows .exe handling)
- Conditional test execution based on toolchain availability

This testing framework serves as the primary quality gate ensuring the MCP debugger functions reliably across all supported languages, deployment scenarios, and integration patterns, providing confidence for production releases and preventing regressions in debugging functionality.