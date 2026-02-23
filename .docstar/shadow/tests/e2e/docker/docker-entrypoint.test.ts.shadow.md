# tests\e2e\docker\docker-entrypoint.test.ts
@source-hash: 18113ac79ba05773
@generated: 2026-02-23T15:26:00Z

## Purpose
End-to-end regression test for Docker container entrypoint argument passing. Specifically validates that CLI arguments are correctly passed without character corruption (fixes a bug where printf-generated entry.sh produced literal `\"` characters breaking SSE mode).

## Test Configuration
- **Test Suite**: `'Docker: Entrypoint Argument Passing'` (L22-94)
- **Environment Controls**: `SKIP_DOCKER` flag bypasses tests if Docker unavailable (L19)
- **Image Configuration**: Uses `DOCKER_IMAGE_NAME` env var or defaults to `'mcp-debugger:local'` (L20)
- **Setup**: `buildDockerImage()` builds test image before all tests (L23-25)

## Test Cases

### Version Command Test (L27-41)
Validates `--version` argument passes cleanly without corruption:
- Runs `docker run --rm ${IMAGE_NAME} --version`
- Expects version output (semver pattern `/\d+\.\d+/`)
- Rejects error messages indicating argument corruption

### SSE Help Command Test (L43-57)
Validates `sse --help` subcommand argument passing:
- Runs `docker run --rm ${IMAGE_NAME} sse --help`
- Expects SSE help output containing `-p` option and `sse` text
- Rejects unknown option errors

### SSE Mode Integration Test (L59-93)
Full integration test starting SSE server with port argument:
- Creates temporary container with `sse -p 3001` command
- Validates container remains running (doesn't exit on arg corruption)
- Checks logs for absence of argument parsing errors
- Includes proper cleanup with container stop/remove

## Dependencies
- **Vitest**: Test framework (L12)
- **Node.js**: `child_process.exec` for Docker commands (L13-14, L17)
- **Docker Utilities**: `buildDockerImage()` from `./docker-test-utils.js` (L15)

## Key Test Pattern
All tests use `execAsync()` (promisified `exec`) with timeouts to run Docker commands and validate output/behavior. The tests are designed to catch a specific regression where shell quoting bugs caused CLI arguments to contain literal quote characters.