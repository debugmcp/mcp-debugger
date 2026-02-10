# packages/adapter-javascript/tests/unit/javascript-debug-adapter.transform.test.ts
@source-hash: 66f862cabee28827
@generated: 2026-02-09T18:14:08Z

This is a comprehensive unit test file for testing the `transformLaunchConfig` method of the `JavascriptDebugAdapter` class, specifically verifying launch configuration transformation logic for JavaScript and TypeScript debugging scenarios.

## Primary Purpose
Tests the transformation of debug launch configurations, ensuring proper defaults are applied, TypeScript tooling is detected and configured, and environment variables are handled correctly without mutation.

## Test Structure & Key Components

**Main Test Suite** (L50-259): `JavascriptDebugAdapter.transformLaunchConfig` 
- Tests configuration transformation for various JavaScript/TypeScript scenarios
- Uses beforeEach/afterEach hooks for adapter setup and environment cleanup (L54-69)

**Mock Setup** (L5-25): 
- Mocks `config-transformer.js` utilities: `isESMProject`, `hasTsConfigPaths`, `determineOutFiles`
- Mocks `typescript-detector.js` utility: `detectBinary` 
- Preserves original implementations while allowing spy functionality

**Test Dependencies** (L37-44):
- Minimal `AdapterDependencies` stub with logger interface
- `norm()` helper function (L46-48) for cross-platform path normalization

## Key Test Scenarios

**Basic JavaScript Configuration** (L71-95):
- Verifies default values: `type: 'pwa-node'`, `sourceMaps: false`, `smartStep: true`
- Tests environment variable handling with `NODE_ENV: 'development'` default
- Ensures `process.env` immutability during transformation

**Source Maps & OutFiles** (L97-112):
- Tests automatic outFiles generation when sourceMaps enabled
- Verifies `resolveSourceMapLocations` configuration

**TypeScript with ts-node** (L114-136):
- Tests automatic TypeScript detection and configuration
- Verifies runtime hooks injection (`-r ts-node/register`)
- Tests sourceMaps auto-enablement

**TypeScript with tsx** (L138-152):
- Tests tsx priority over ts-node when available
- Verifies no additional hooks needed for tsx runtime

**ESM Project Support** (L154-172):
- Tests ESM loader configuration (`--loader ts-node/esm`) for `.mts` files
- Uses `isESMProject` mock for project type detection

**tsconfig-paths Integration** (L174-191):
- Tests automatic tsconfig-paths/register injection when paths mapping detected
- Uses `hasTsConfigPaths` mock for configuration detection

**Runtime Arguments Handling** (L193-235):
- Tests preservation and ordering of user-provided runtime arguments
- Tests deduplication logic to prevent duplicate hooks
- Verifies behavior with explicit runtime executable overrides

**Environment & Configuration Isolation** (L237-258):
- Tests user environment variable merging without `process.env` mutation
- Tests user-provided outFiles preservation

## Critical Patterns
- Extensive mocking of file system and binary detection utilities
- Environment state preservation/restoration in test lifecycle
- Path normalization for cross-platform compatibility
- Mock function behavior simulation for different toolchain scenarios