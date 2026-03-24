# E2E Smoke Tests

This directory contains end-to-end smoke tests that verify the MCP debugger server works correctly across different transport mechanisms and deployment scenarios.

## Test Files

### 1. `mcp-server-smoke-sse.test.ts`
- Tests SSE (Server-Sent Events) transport
- Uses dynamic port allocation to avoid conflicts
- Verifies HTTP/SSE connection and debugging workflow
- Tests spawning from different working directories

### 2. Docker smoke tests (`docker/` subdirectory)
- Tests containerized deployment for Python, JavaScript, and Rust
- Verifies Docker setup works end-to-end
- Tests path translation (host paths to container paths), session lifecycle, core debug actions, and cleanup
- Includes Docker availability check with graceful skip
- Includes `docker-entrypoint.test.ts` for testing the Docker entrypoint script
- Includes `docker-smoke-rust.test.ts` for Rust-specific container tests

### 3. `mcp-server-smoke-javascript.test.ts`
- Tests JavaScript adapter through MCP interface
- Validates known quirks:
  - Breakpoints may report "unverified" initially but still work
  - Stack trace retrieval uses `includeInternals: false` to filter out Node internal frames
  - Variable references change after steps (refresh pattern required)
- Tests core functionality: breakpoints, stepping, variables, expressions
- Multiple test scenarios including multiple breakpoints and step-into

### 4. `mcp-server-smoke-python.test.ts`
- Tests Python adapter through MCP interface
- Validates Python-specific behaviors:
  - Breakpoints are initially unverified, then verified asynchronously after the debugger connects
  - Clean stack traces without internal frames
  - Stable variable references (no refresh needed)
  - Requires absolute paths for script execution
  - Expression-only evaluation (statements rejected)
- Comprehensive test coverage including step-into operations

### 5. `mcp-server-smoke-go.test.ts`
- Tests Go adapter through MCP interface
- Validates Go-specific debugging behavior via Delve

### 6. `mcp-server-smoke-rust.test.ts`
- Tests Rust adapter through MCP interface
- Validates Rust-specific debugging behavior via CodeLLDB

### 7. `mcp-server-smoke-java.test.ts`
- Tests Java adapter through MCP interface
- Validates Java-specific debugging behavior via JDI bridge

### 8. `mcp-server-smoke-java-attach.test.ts`
- Tests Java attach mode through MCP interface
- Validates JDWP attach workflow

### 9. `mcp-server-smoke-java-evaluate.test.ts`
- Tests Java expression evaluation through MCP interface

### 10. `mcp-server-smoke-java-inner-class.test.ts`
- Tests Java inner class debugging through MCP interface

### 11. `mcp-server-smoke-dotnet.test.ts`
- Tests .NET/C# adapter through MCP interface
- Validates .NET debugging behavior via netcoredbg

### 12. `mcp-server-smoke-javascript-sse.test.ts`
- Tests JavaScript adapter over SSE transport
- Validates SSE connection with JavaScript debugging workflow

### 13. `comprehensive-mcp-tools.test.ts`
- Comprehensive tests for all MCP tool operations
- Validates full debugging tool coverage end-to-end

### 14. `debugpy-connection.test.ts`
- Tests direct debugpy connection behavior
- Validates DAP protocol communication with debugpy

### 15. `smoke-test-utils.ts`
- Shared utilities for all smoke tests
- Common debug sequence execution
- Docker and SSE helper functions
- Cross-platform compatibility utilities

### 16. `rust-example-utils.ts`
- Shared utilities for Rust E2E tests
- Rust example project building and management

### 17. NPX smoke tests (`npx/` subdirectory)
- `npx-smoke-python.test.ts` - Tests Python debugging via the npx distribution
- `npx-smoke-javascript.test.ts` - Tests JavaScript debugging via the npx distribution
- `npx-test-utils.ts` - Shared utilities for NPX smoke tests

## Running the Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run only smoke tests
npm run test:e2e:smoke

# Run individual smoke test
npx vitest run tests/e2e/mcp-server-smoke-sse.test.ts
npx vitest run tests/e2e/docker/  # Docker smoke tests
npx vitest run tests/e2e/mcp-server-smoke-javascript.test.ts
npx vitest run tests/e2e/mcp-server-smoke-python.test.ts
npx vitest run tests/e2e/mcp-server-smoke-go.test.ts
npx vitest run tests/e2e/mcp-server-smoke-rust.test.ts
npx vitest run tests/e2e/mcp-server-smoke-java.test.ts
npx vitest run tests/e2e/mcp-server-smoke-java-attach.test.ts
npx vitest run tests/e2e/mcp-server-smoke-java-evaluate.test.ts
npx vitest run tests/e2e/mcp-server-smoke-java-inner-class.test.ts
npx vitest run tests/e2e/mcp-server-smoke-dotnet.test.ts
npx vitest run tests/e2e/mcp-server-smoke-javascript-sse.test.ts
npx vitest run tests/e2e/comprehensive-mcp-tools.test.ts
npx vitest run tests/e2e/debugpy-connection.test.ts
npx vitest run tests/e2e/npx/  # NPX smoke tests
```

## Prerequisites

### For Python Tests
- Python 3.7+ must be installed
- debugpy must be installed: `pip install debugpy`

### For Go Tests
- Go 1.18+ must be installed
- Delve debugger must be installed: `go install github.com/go-delve/delve/cmd/dlv@latest`

### For Java Tests
- JDK 21+ must be installed (`java` and `javac` on PATH, or `JAVA_HOME` set)
- Target code must be compiled with `javac -g` for variable inspection

### For .NET Tests
- .NET 6+ SDK must be installed
- netcoredbg must be installed (set `NETCOREDBG_PATH` or add to PATH)

### For Rust Tests
- Rust toolchain must be installed (rustc, cargo)
- Uses vendored CodeLLDB debug adapter (auto-downloaded during `pnpm install`)

### For SSE Tests
- No special requirements (uses dynamic port allocation)

### For Container Tests
- Docker must be installed and running
- Tests will skip automatically if Docker is not available

## Test Coverage

The smoke tests provide comprehensive coverage of:
1. **Transport Methods**: stdio, SSE, JavaScript-SSE, containerized stdio
2. **Language Adapters**: All 7 adapters (Python, JavaScript, Rust, Go, Java, .NET/C#, Mock)
3. **Path Resolution**: Different working directories, path translation, absolute vs relative paths
4. **Environment Handling**: Container environment variables, volume mounts
5. **Error Scenarios**: Proper cleanup on failure, detailed error logging
6. **Adapter Quirks**: Tests actual behavior, not idealized expectations

### JavaScript Adapter Coverage
- Unverified breakpoint handling
- Node internal frame filtering
- Variable reference refresh pattern
- Expression evaluation
- Source context retrieval

### Python Adapter Coverage
- Asynchronous breakpoint verification
- Clean stack traces
- Stable variable references
- Absolute path requirements
- Expression vs statement evaluation

## Key Features

- **Consistent Structure**: All tests follow the same pattern for easy maintenance
- **Robust Cleanup**: Ensures processes and containers are cleaned up even on failure
- **Detailed Logging**: Comprehensive logging for debugging test failures
- **Skip Conditions**: Graceful handling when prerequisites aren't met
- **Performance Optimized**: Docker image caching, dynamic port allocation
- **Cross-Platform**: Works on Windows, Linux, and macOS

## Troubleshooting

### SSE Test Failures
- Check if port is already in use (tests use dynamic ports to minimize this)
- Verify the server health endpoint is responding
- Check server logs for startup errors

### Container Test Failures
- Ensure Docker is installed: `docker --version`
- Check Docker is running: `docker ps`
- Verify Docker image builds successfully: `npm run docker-build`
- Check container logs (automatically captured on failure)

### Common Issues
- **Timeout errors**: Increase TEST_TIMEOUT if needed
- **Path not found**: Ensure the project is built (`npm run build`)
- **Permission errors**: May need elevated permissions for Docker
