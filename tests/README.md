# Testing Guide for Debug MCP Server

This guide provides information about how to run tests and how to structure new tests for the Debug MCP Server.

## Running Tests Locally with Act

For running GitHub Actions workflows locally (especially container tests), we use [Act](https://github.com/nektos/act).

### Prerequisites for Container Tests

1. **Docker**: Ensure Docker is installed and running
2. **Act**: Install Act following the [official instructions](https://github.com/nektos/act#installation)
3. **Docker Image**: Build the MCP debugger Docker image:
   ```bash
   docker build -t mcp-debugger:local .
   ```

### Platform-Specific Requirements

#### Windows Requirements
- **CRITICAL**: Run Act inside WSL2 (required for Docker operations)
- Ensure Docker Desktop WSL2 integration is enabled
- Open WSL2 terminal and run Act from there
- Do NOT run Act from Windows CMD/PowerShell

#### Apple Silicon (M1/M2) Requirements
- The `.actrc` file already includes `--container-architecture linux/amd64`
- Alternatively, build multi-arch images for `mcp-debugger:local`

### Running Tests with Act

With the updated `.actrc` configuration, Act will:
- Use your local `catthehacker/ubuntu:act-latest` image
- Default to the CI workflow (to avoid running both workflows)
- Not pull images from the registry

```bash
# Simple commands (using helper scripts):
./scripts/act-test.sh ci      # Linux/macOS
scripts\act-test.cmd ci        # Windows

# Run CI workflow tests (default)
act -j build-and-test --matrix os:ubuntu-latest

# Run only E2E tests
./scripts/act-test.sh e2e

# Run Release workflow tests
act -W .github/workflows/release.yml -j build-and-test
```

**Note**: The CI workflow runs on every push/PR, while the Release workflow only runs when you create version tags (e.g., `v1.0.0`).

### Act Configuration

The project includes an `.actrc` file with optimized settings:
- Uses full Docker-enabled runner images (`catthehacker/ubuntu:full-22.04`)
- Enables `--bind` for proper volume mounting
- Enables `--privileged` for Docker daemon access
- Sets container architecture for cross-platform compatibility

## Running Tests Directly

The project uses Jest/Vitest as the testing framework. There are several scripts available to run tests:

### Run All Tests

```bash
npm test
```

### Run Unit Tests Only

```bash
tests/runners/run-tests.cmd unit
```

### Run Integration Tests Only

```bash
tests/runners/run-tests.cmd integration
```

### Run E2E Tests Only

```bash
tests/runners/run-tests.cmd e2e
```

### Development Testing

```bash
tests/runners/dev-test.cmd
```

This interactive script:
- Builds the project
- Restarts the MCP server with debug logging
- Provides options to run unit, integration, E2E, or all tests
- Allows keeping the server running for development

### Run Specific Test File

```bash
tests/runners/run-tests.cmd unit path/to/test/file.test.ts
```

## Testing Structure

The tests are organized into three main categories:

1. **Unit Tests**: Tests individual components in isolation by mocking their dependencies
2. **Integration Tests**: Tests interactions between multiple components
3. **E2E Tests**: Tests the entire application flow

### Test Directory Structure

```
tests/
├── e2e/                 # End-to-end tests
├── fixtures/            # Test data and fixtures
│   └── python/          # Python scripts for testing
├── integration/         # Integration tests
├── mocks/               # Mock implementations for testing
├── runners/             # Test runner scripts
├── unit/                # Unit tests
│   ├── debugger/        # Tests for debugger components
│   ├── session/         # Tests for session management
│   └── utils/           # Tests for utility functions
└── utils/               # Test utility functions
```

## Writing Tests

When writing tests, follow these guidelines:

### Unit Tests

- Mock all external dependencies
- Test a single responsibility
- Use descriptive test names
- Structure tests with arrange-act-assert pattern
- For tests involving the DAP protocol, use the mock DAP client

### Integration Tests

- Mock external services (like debugpy server)
- Test interactions between components
- Focus on component boundaries

### E2E Tests

- Minimize mocking
- Test complete workflows from user perspective

## Common Testing Issues

### Port Conflicts

When running tests that involve network connections, port conflicts can occur. To avoid this:

- Use random port numbers for tests
- Ensure ports are released after each test
- Use the global `testPortManager` to manage port allocation

### Python Environment

Tests requiring Python need the Python interpreter to be available. Ensure your system has Python installed and available in the PATH.

### Asynchronous Testing

Many operations in the Debug MCP Server are asynchronous. When testing:

- Always await async functions
- Use Jest's async test support (async/await in test functions)
- Be careful with timeouts

## Test Coverage

The project aims for high test coverage. Run the coverage report with:

```bash
npm run test:coverage
```

Focus on improving coverage in critical areas like:
- Debug protocol implementation
- Session management
- Error handling

## Debugging Tests

For debugging failing tests:
- Use the `--debug` flag with Jest/Vitest
- Add console logs in tests (they will appear in test output)
- Examine the log files in the `logs/` directory

### Debugging Container Tests

When container tests fail:
1. Check if the Docker image exists: `docker images | grep mcp-debugger`
2. Verify Act environment: `echo $ACT` (should be "true" when running in Act)
3. Check Docker daemon access: `docker ps`
4. Review container logs in test output

### Common Container Test Issues

1. **"Script path not found" errors**: Usually indicates volume mount issues
   - Ensure `.actrc` includes `--bind` flag
   - Check that paths are relative, not absolute

2. **"spawn node ENOENT" errors**: Node.js not found in PATH
   - The Python discovery test now handles Act environment automatically
   - For other tests, ensure proper PATH configuration

3. **Docker command failures**: Docker not available in Act container
   - Ensure using `catthehacker/ubuntu:full-*` images (not `act-*` variants)
   - Verify `--privileged` flag is set

## Alternative: Testcontainers

If Act proves problematic for your environment, consider using the [Testcontainers](https://testcontainers.com/) library as an alternative approach for container-based testing.
