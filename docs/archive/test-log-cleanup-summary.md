# Test Log Cleanup Summary

## Changes Made

### 1. Fixed Double Test Run Issue
**Problem**: When running `npm run act:test`, both CI and Release workflows were being executed because both have a job named `build-and-test`.

**Solution**: Updated `package.json` to explicitly specify the CI workflow:
```json
"act:test": "scripts\\act-runner.cmd -W .github/workflows/ci.yml -j build-and-test --matrix os:ubuntu-latest"
```

### 2. Removed Environment-Based Logging Configuration
**Problem**: Tests were setting environment variables (`LOG_LEVEL`, `DEBUG_MCP_LOG_LEVEL`) which violates the architectural principle of no environment-based behavior changes.

**Solution**: 
- Removed environment variable settings from `tests/jest.setupAfterEnv.ts`
- Added `createTestServer` helper in `tests/utils/test-dependencies.ts` that creates servers with `{ logLevel: 'error' }`

### 3. Made Python Detection Logs Configurable
**Problem**: Python detection was using `console.error` directly, bypassing the configured log level.

**Solution**:
- Added optional `logger` parameter to `findPythonExecutable` function
- Default to a no-op logger if not provided
- Updated `SessionManager` to pass its logger to `findPythonExecutable`

## Results

- ✅ Tests now run only once with `npm run act:test`
- ✅ Test output is significantly cleaner
- ✅ Architecture follows the principle of explicit configuration over environment detection
- ✅ Python detection logs respect the configured log level in production

## Remaining Work

Some test files may still show Python detection logs because they call `findPythonExecutable` directly without passing a logger. These can be updated individually as needed by:

1. Using the `createTestServer` helper for integration tests
2. Passing a mock logger when calling `findPythonExecutable` in unit tests

## Usage

For new tests that need a server instance:
```typescript
import { createTestServer } from '../utils/test-dependencies';

const server = createTestServer(); // Automatically configured with logLevel: 'error'
```

For tests that call Python detection directly:
```typescript
import { findPythonExecutable } from '../../src/utils/python-utils';
import { createMockLogger } from '../utils/test-dependencies';

const logger = createMockLogger(); // Mock logger that doesn't output
const executablePath = await findPythonExecutable(undefined, logger);
