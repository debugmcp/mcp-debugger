# Vitest LLM-Friendly Configuration

This document describes the configuration changes made to optimize Vitest output for LLM consumption.

## Overview

The default Vitest output can generate hundreds of kilobytes of console logs, which overwhelms LLM context windows. The configuration below cuts that down sharply while preserving essential debugging information. (The size figures in this document are indicative of the original change, not a current measurement.)

## Configuration Changes

### 1. vitest.config.ts

The root `vitest.config.ts` owns all of this: globals, environment, resolve aliases, the three
test projects (`unit`, `integration`, `e2e`), coverage — and both output knobs this document is
about.

- **Console filtering**: `onConsoleLog` is defined in the config file and spread into every
  project via `sharedProjectTest`, so all three projects filter identically. Its pattern lists
  are described under [Console Filtering](#console-filtering) below.
- **Reporters**: `reporters: process.env.CI ? ['dot', 'json'] : ['default']`, with
  `outputFile: { json: './test-results.json' }`. On CI the JSON report is written from the main
  process, so it survives a fork-worker death and still records which file never reported.

The npm scripts below layer `--reporter` / `--silent` overrides on top of that; they do not
supply the filtering themselves.

### 2. NPM Scripts

Roughly ordered from quietest to loudest:

| Script | Description |
|--------|-------------|
| `test:summary` | Custom summary only (`tests/test-utils/helpers/test-summary.js`) |
| `test:coverage:summary` | Coverage summary only (`tests/test-utils/helpers/test-coverage-summary.js`) |
| `test:quiet` | Ultra-minimal (`--reporter=dot --silent`) |
| `test:dot` | Minimal dot reporter |
| `test:failures` | Only failed tests (`tests/test-utils/helpers/show-failures.js`) |
| `test:json` | JSON to `test-results.json`, no console report |
| `test:coverage:json` | Coverage + JSON to `test-results.json` |
| `test:coverage:quiet` | Coverage with `--reporter=dot --silent` |
| `test:coverage` | Standard coverage run — thresholds are enforced (90% statements / 80% branches) |
| `test:verbose` | Full output, for debugging |

### 3. Utility Scripts

#### test-summary.js
- Runs tests with JSON output
- Displays clean summary with pass/fail counts
- Lists failed test names only

#### show-failures.js
- Runs tests and shows only failures
- Includes clean error messages
- Uses `child_process.spawn` with `stdio: 'inherit'` (test output streams directly to the console) and `shell: true`

#### test-results-analyzer.js
- Analyzes existing JSON results
- Three detail levels: summary, failures, detailed
- Usage: `node tests/test-utils/helpers/test-results-analyzer.js --level=summary`

## Usage Examples

### For CI/LLM Analysis
```bash
npm run test:quiet  # Minimal output
npm run test:summary  # Clean summary
```

### For Debugging
```bash
npm run test:failures  # See what's failing
npm run test:verbose  # Full output when needed
```

### For Programmatic Analysis
```bash
npm run test:json  # Generate JSON
node tests/test-utils/helpers/test-results-analyzer.js --level=detailed
```

## Console Filtering

The `onConsoleLog` filters these noise patterns:
- vite/webpack messages
- HMR notifications
- Debugger listening messages
- Python path outputs
- Build/transform messages
- Server logs ([MCP Server], [debug-mcp], [ProxyManager])
- Timestamps (2025-, etc.)
- Log levels ([info], [debug], [warn])
- Stream prefixes (stdout |, stderr |)

While preserving:
- Error messages
- Assertion failures
- Test failure details
- User console.log in tests

## Additional Enhancements

### Path Compatibility
Scripts that spawn Vitest (such as `test-summary.js` and `show-failures.js`) use separate arguments for file paths to handle spaces in directory names:
```javascript
// Instead of: ['--outputFile=' + jsonFile]
// We use: ['--outputFile', jsonFile]
```

### Console Silencing Override
The test setup file (`tests/vitest.setup.ts`) deletes `process.env.CONSOLE_OUTPUT_SILENCED` so unit tests default to visible console output unless a test explicitly sets silencing.

## Results

- Test output reduced by roughly an order of magnitude (indicative, from the original change — not re-measured since)
- No spinner animations
- Structured output for programmatic parsing
- Multiple output options for different use cases
- Cross-platform compatibility
