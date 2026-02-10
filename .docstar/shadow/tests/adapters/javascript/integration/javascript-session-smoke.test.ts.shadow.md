# tests/adapters/javascript/integration/javascript-session-smoke.test.ts
@source-hash: e4354114cdb6d289
@generated: 2026-02-09T18:14:12Z

## Purpose
Integration smoke test for JavaScript adapter session functionality, validating launch configuration transformation and adapter command building.

## Key Test Structure
- **Test Suite (L11)**: `JavaScript adapter - session smoke (integration)` - Single integration test for basic JavaScript adapter functionality
- **Main Test (L37)**: Validates tsx runtime override and adapter command generation with path assertions

## Test Configuration (L12-17)
- **Platform Detection (L12)**: Cross-platform support with Windows-specific path handling
- **Session Parameters**: Fixed session ID `session-js-3`, localhost adapter on port 56789
- **Test Paths**: Platform-specific TypeScript file paths for testing

## Utility Functions
- **norm() (L7-9)**: Path normalization helper converting backslashes to forward slashes for consistent assertions

## Test Setup/Teardown (L19-35)
- **beforeEach (L21-25)**: Preserves NODE_OPTIONS environment, resets adapter registry, clears mocks
- **afterEach (L27-35)**: Restores NODE_OPTIONS environment variable, resets registry, restores mocks

## Core Test Logic (L37-82)
1. **Registry Setup (L39-40)**: Creates adapter registry with validation disabled, registers JavaScript adapter
2. **Adapter Configuration (L42-51)**: Builds adapter config with session parameters and dummy TypeScript script
3. **Launch Config Transformation (L56-71)**: Tests transformLaunchConfig with tsx runtime override, validates empty runtime args
4. **Command Building (L74-82)**: Validates buildAdapterCommand output structure and js-debug vendor path

## Key Dependencies
- **Vitest**: Test framework with mocking capabilities
- **JavascriptAdapterFactory**: Main adapter implementation being tested
- **Adapter Registry**: Central registry system for adapter management

## Test Assertions
- Validates tsx runtime executable configuration
- Ensures adapter command uses absolute paths
- Confirms js-debug vendor script path structure
- Verifies port configuration propagation