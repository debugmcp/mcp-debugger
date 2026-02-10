# tests/adapters/javascript/integration/javascript-session-smoke.test.ts
@source-hash: e4354114cdb6d289
@generated: 2026-02-10T00:41:10Z

## Purpose and Responsibility

Integration smoke test for JavaScript adapter session functionality, validating TypeScript configuration handling and adapter command generation with tsx runtime.

## Key Components

### Test Configuration (L11-17)
- Platform detection for Windows vs Unix path handling
- Session ID `session-js-3` for test isolation
- Dummy TypeScript file paths with platform-specific separators
- Log directory and adapter host/port configuration

### Helper Functions

#### `norm(p: unknown)` (L7-9)
Normalizes paths by converting backslashes to forward slashes for cross-platform assertions.

### Test Lifecycle (L19-35)
- **beforeEach (L21-25)**: Preserves NODE_OPTIONS environment, resets adapter registry, clears mocks
- **afterEach (L27-35)**: Restores NODE_OPTIONS state, resets registry, restores mocks

### Main Test Case (L37-82)
**"provides js-debug launch config and adapter command"**

#### Adapter Setup (L38-53)
- Creates registry with validation disabled
- Registers JavascriptAdapterFactory
- Configures adapter with session parameters including TypeScript script path

#### Launch Configuration Testing (L55-71)
- Tests `transformLaunchConfig` with explicit tsx runtime override
- Validates runtimeExecutable is set to 'tsx'
- Verifies runtimeArgs are empty or undefined

#### Command Building Assertions (L73-82)
- Tests `buildAdapterCommand` output structure
- Validates command path is absolute
- Asserts adapter path ends with `/vendor/js-debug/vsDebugServer.cjs`
- Verifies port argument matches expected value (56789)

## Dependencies
- **vitest**: Testing framework
- **adapter-registry**: Core adapter registration system
- **JavascriptAdapterFactory**: JavaScript/TypeScript adapter implementation

## Architectural Notes
- Uses type assertions (`as any`) for flexibility with adapter interfaces
- Cross-platform path handling via platform detection and normalization
- Environment variable preservation pattern for test isolation
- Smoke testing approach focusing on key integration points rather than exhaustive coverage