# tests/test-utils/mocks/environment.ts
@source-hash: ac99000281932f84
@generated: 2026-02-10T00:41:26Z

## Purpose
Test utility module providing environment variable mocking for Vitest tests, specifically designed to mock interactions with `src/utils/container-path-utils.ts`.

## Key Components

### EnvironmentMock Interface (L3-7)
Defines the contract for environment mocking with three methods:
- `get(key: string)`: Retrieves environment variable values
- `getEnv()`: Returns complete environment variable object
- `isWindows()`: Platform detection for Windows

### createEnvironmentMock Factory (L19-25)
Creates mock instances with sensible defaults for container path testing:
- **Default behavior**: `get('MCP_CONTAINER')` returns `'false'` (host mode)
- **Fallback**: Other environment variables delegate to `process.env`
- **Platform detection**: `isWindows()` uses actual `process.platform`
- **Environment object**: `getEnv()` returns empty object by default
- **Extensibility**: Accepts `overrides` parameter for test-specific customization

## Dependencies
- **vitest**: Uses `vi.fn()` for function mocking
- **Node.js globals**: Accesses `process.env` and `process.platform`

## Design Patterns
- **Factory pattern**: Provides consistent mock creation with customization
- **Interface segregation**: Clean contract definition separate from implementation
- **Test isolation**: Each mock instance is independent with vi.fn() spies

## Critical Constraints
- Mock is specifically tailored for container path utilities testing
- Default `MCP_CONTAINER='false'` assumption may not suit all test scenarios
- Platform detection uses real process state, not mocked