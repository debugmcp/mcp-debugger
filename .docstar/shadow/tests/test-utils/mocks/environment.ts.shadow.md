# tests/test-utils/mocks/environment.ts
@source-hash: ac99000281932f84
@generated: 2026-02-09T18:14:35Z

## Purpose
Test utility for mocking environment dependencies in unit tests, specifically designed to support `src/utils/container-path-utils.ts`. Provides a consistent interface for testing environment variable access and platform detection.

## Core Components

### EnvironmentMock Interface (L3-7)
Defines the contract for environment mocking:
- `get(key: string)`: Retrieves environment variable values
- `getEnv()`: Returns complete environment variable object
- `isWindows()`: Platform detection utility

### createEnvironmentMock Factory (L19-25)
Primary factory function that creates configured environment mocks with sensible test defaults:
- **Default behavior**: `MCP_CONTAINER` returns `'false'` (host mode for tests)
- **Fallback**: Other environment variables delegate to `process.env`
- **Platform detection**: Uses actual `process.platform === 'win32'`
- **Customization**: Accepts partial overrides for test-specific behavior

## Key Behaviors
- All mock methods are Vitest spy functions (`vi.fn()`) for assertion capabilities
- Container mode defaults to disabled (`'false'`) in test environment
- Platform detection uses real system platform unless overridden
- Supports partial override pattern for flexible test configuration

## Dependencies
- **vitest**: For mock function creation (`vi.fn()`)
- **Node.js process**: For environment and platform access

## Usage Pattern
Designed for dependency injection in tests requiring environment simulation, particularly for container path resolution logic.