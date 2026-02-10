# packages/adapter-javascript/tests/unit/javascript-debug-adapter.transform.test.ts
@source-hash: 66f862cabee28827
@generated: 2026-02-10T00:41:14Z

## Primary Purpose
Unit tests for the `JavascriptDebugAdapter.transformLaunchConfig` method, validating configuration transformation logic for JavaScript and TypeScript debugging scenarios.

## Test Structure
- **Main test suite** (L50-259): `JavascriptDebugAdapter.transformLaunchConfig`
- **Setup/teardown** (L54-69): Mock clearing, environment variable preservation/restoration
- **Test adapter instance** (L51-55): Created fresh per test with minimal logger dependencies

## Key Test Categories

### Basic JavaScript Configuration (L71-95)
Tests default configuration transformation for JS files:
- Sets `type: 'pwa-node'`, `request: 'launch'` 
- Applies default `sourceMaps: false`, `smartStep: true`
- Normalizes working directory to program directory
- Merges environment with `NODE_ENV: 'development'` default
- Sets default `skipFiles` patterns for Node internals/modules

### Source Map Handling (L97-112)
Validates source map configuration when `sourceMaps: true`:
- Applies default `outFiles` patterns via `determineOutFiles` mock
- Sets `resolveSourceMapLocations` excludes

### TypeScript Support Detection (L114-136, L138-152)
Tests TypeScript binary detection and configuration:
- **ts-node detection** (L114-136): Enables source maps, adds runtime args for register hooks
- **tsx priority** (L138-152): Prefers tsx over ts-node when available, no additional hooks needed

### ESM Project Handling (L154-172)
Tests ESM-specific ts-node configuration:
- Adds `--loader ts-node/esm` for `.mts` files when `isESMProject` returns true

### Path Resolution (L174-191)
Tests tsconfig paths integration:
- Adds `tsconfig-paths/register` hook when `hasTsConfigPaths` returns true

### User Configuration Preservation (L193-245)
Validates user-provided settings are preserved:
- **Runtime args** (L193-207): User args appended after auto-detected hooks
- **Runtime executable overrides** (L209-235): Respects manual tsx/ts-node settings, prevents duplicates
- **Output files** (L237-245): User `outFiles` passed through unchanged

### Environment Safety (L247-258)
Ensures process.env isolation during configuration transformation.

## Mock Dependencies
- **config-transformer.js** (L5-15): `isESMProject`, `hasTsConfigPaths`, `determineOutFiles`
- **typescript-detector.js** (L17-25): `detectBinary` for tool detection
- **Adapter dependencies** (L37-44): Minimal logger stub for constructor

## Utilities
- **norm() function** (L46-48): Normalizes path separators for cross-platform testing
- **Environment restoration** (L60-69): Comprehensive process.env cleanup between tests

## Key Patterns
- Extensive mocking of filesystem/binary detection utilities
- Path normalization for cross-platform compatibility  
- Environment variable isolation to prevent test pollution
- Configuration object validation with type casting (`as any`)