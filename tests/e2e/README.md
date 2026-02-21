# E2E Smoke Tests

This directory contains end-to-end smoke tests that verify the MCP debugger server works correctly across different transport mechanisms and deployment scenarios.

## Test Files

### 1. `mcp-server-smoke.test.ts` (Existing)
- Tests stdio transport
- Verifies basic debugging workflow
- Tests spawning from different working directories

### 2. `mcp-server-smoke-sse.test.ts` (New)
- Tests SSE (Server-Sent Events) transport
- Uses dynamic port allocation to avoid conflicts
- Verifies HTTP/SSE connection and debugging workflow
- Tests spawning from different working directories

### 3. `mcp-server-smoke-container.test.ts` (New)
- Tests containerized deployment
- Verifies Docker setup works end-to-end
- Tests path translation (host paths → container paths)
- Includes Docker availability check with graceful skip
- Tests volume mounting and environment variable handling

### 4. `mcp-server-smoke-javascript.test.ts` (New)
- Tests JavaScript adapter through MCP interface
- Validates known quirks:
  - Breakpoints may report "unverified" initially but still work
  - Stack traces include Node internal frames
  - Variable references change after steps (refresh pattern required)
- Tests core functionality: breakpoints, stepping, variables, expressions
- Multiple test scenarios including multiple breakpoints and step-into

### 5. `mcp-server-smoke-python.test.ts` (New)
- Tests Python adapter through MCP interface
- Validates Python-specific behaviors:
  - Breakpoints are initially unverified, then verified asynchronously after the debugger connects
  - Clean stack traces without internal frames
  - Stable variable references (no refresh needed)
  - Requires absolute paths for script execution
  - Expression-only evaluation (statements rejected)
- Comprehensive test coverage including step-into operations

### 6. `mcp-server-smoke-go.test.ts` (New)
- Tests Go adapter through MCP interface
- Validates Go-specific debugging behavior via Delve

### 7. `mcp-server-smoke-rust.test.ts` (New)
- Tests Rust adapter through MCP interface
- Validates Rust-specific debugging behavior via CodeLLDB

### 8. `mcp-server-smoke-javascript-sse.test.ts` (New)
- Tests JavaScript adapter over SSE transport
- Validates SSE connection with JavaScript debugging workflow

### 9. `comprehensive-mcp-tools.test.ts` (New)
- Comprehensive tests for all MCP tool operations
- Validates full debugging tool coverage end-to-end

### 10. `debugpy-connection.test.ts` (New)
- Tests direct debugpy connection behavior
- Validates DAP protocol communication with debugpy

### 11. `smoke-test-utils.ts` (New)
- Shared utilities for all smoke tests
- Common debug sequence execution
- Docker and SSE helper functions
- Cross-platform compatibility utilities

## Running the Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run only smoke tests
npm run test:e2e:smoke

# Run individual smoke test
npx vitest run tests/e2e/mcp-server-smoke-sse.test.ts
npx vitest run tests/e2e/mcp-server-smoke-container.test.ts
npx vitest run tests/e2e/mcp-server-smoke-javascript.test.ts
npx vitest run tests/e2e/mcp-server-smoke-python.test.ts
npx vitest run tests/e2e/mcp-server-smoke-go.test.ts
npx vitest run tests/e2e/mcp-server-smoke-rust.test.ts
npx vitest run tests/e2e/mcp-server-smoke-javascript-sse.test.ts
npx vitest run tests/e2e/comprehensive-mcp-tools.test.ts
npx vitest run tests/e2e/debugpy-connection.test.ts
```

## Prerequisites

### For Python Tests
- Python 3.7+ must be installed
- debugpy must be installed: `pip install debugpy`

### For Go Tests
- Go 1.18+ must be installed
- Delve debugger must be installed: `go install github.com/go-delve/delve/cmd/dlv@latest`

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
2. **Language Adapters**: All 5 adapters (Python, JavaScript, Rust, Go, Mock)
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
