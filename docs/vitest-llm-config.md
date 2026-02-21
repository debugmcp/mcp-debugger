# Vitest LLM-Friendly Configuration

This document describes the configuration changes made to optimize Vitest output for LLM consumption.

## Overview

The default Vitest output can generate 500KB+ of console logs, which overwhelms LLM context windows. Our configuration reduces this to <50KB while preserving essential debugging information.

## Configuration Changes

### 1. vitest.config.ts

Added console filtering and reporter configuration:
- `onConsoleLog` callback filters noise patterns while preserving errors
- `fileParallelism: false` ensures sequential output
- Configurable reporters based on environment

### 2. NPM Scripts

| Script | Description | Output Size |
|--------|-------------|-------------|
| `test:dot` | Minimal dot reporter | ~5KB |
| `test:json` | JSON output to file | No console output |
| `test:quiet` | Ultra-minimal (dot + silent) | ~3KB |
| `test:summary` | Custom summary only | ~1KB |
| `test:failures` | Only failed tests | Variable |
| `test:verbose` | Full output (debugging) | ~500KB+ |
| `test:coverage` | Standard coverage run | ~50KB |
| `test:coverage:quiet` | Coverage with minimal output | ~10KB |
| `test:coverage:summary` | Coverage with clean summary | ~2KB |
| `test:coverage:json` | Coverage + JSON output | No console |

### 3. Utility Scripts

#### test-summary.js
- Runs tests with JSON output
- Displays clean summary with pass/fail counts
- Lists failed test names only

#### show-failures.js
- Runs tests and shows only failures
- Includes clean error messages
- Cross-platform compatible

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
All utility scripts use separate arguments for file paths to handle spaces in directory names:
```javascript
// Instead of: ['--outputFile=' + jsonFile]
// We use: ['--outputFile', jsonFile]
```

### Log Level Configuration
The test setup file (`jest.setupAfterEnv.ts`) sets environment variables to reduce log noise:
```javascript
process.env.LOG_LEVEL = 'error';
process.env.DEBUG_MCP_LOG_LEVEL = 'error';
```

## Results

- Test output reduced by 90%+ (from ~500KB to <50KB)
- No spinner animations
- Structured output for programmatic parsing
- Multiple output options for different use cases
- Cross-platform compatibility
