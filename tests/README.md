# Testing Guide for Debug MCP Server

This guide provides information about how to run tests and how to structure new tests for the Debug MCP Server.

## Running Tests

The project uses Jest as the testing framework. There are several scripts available to run tests:

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
- Use the `--debug` flag with Jest
- Add console logs in tests (they will appear in test output)
- Examine the log files in the `logs/` directory
