# tests/unit/implementations/__mocks__/
@generated: 2026-02-10T01:19:29Z

## Purpose
Mock implementations directory for Node.js built-in and external modules used in unit testing. Provides Jest/Vitest-compatible mocks that replace actual system interactions with controllable test doubles, enabling isolated unit testing without side effects.

## Architecture
Following Jest/Vitest `__mocks__` convention for automatic mock resolution. When tests import mocked modules, the testing framework automatically substitutes these implementations instead of the actual libraries.

### Mock Strategy
- **System Process Isolation**: `child_process.js` mocks subprocess execution to prevent actual process spawning during tests
- **Filesystem Isolation**: `fs-extra.js` provides comprehensive filesystem operation mocking to eliminate file system dependencies

## Key Components

### child_process.js
- **Purpose**: Jest mock for Node.js `child_process` module
- **Exports**: `spawn`, `exec` as Jest mock functions
- **Coverage**: Core subprocess execution methods

### fs-extra.js  
- **Purpose**: Vitest mock for `fs-extra` library
- **Exports**: Comprehensive filesystem API including file operations (`readFile`, `writeFile`), directory operations (`ensureDir`, `mkdir`), path utilities (`pathExists`, `access`), and JSON operations (`readJson`, `outputJson`)
- **Import Compatibility**: Supports both named and default import patterns

## Testing Integration
- **Automatic Resolution**: Testing frameworks automatically use these mocks when the corresponding modules are imported in test files
- **Framework Support**: Mixed Jest (`child_process.js`) and Vitest (`fs-extra.js`) mock implementations
- **Isolation Benefits**: Prevents actual system calls, filesystem modifications, and subprocess execution during unit testing

## Usage Pattern
Test files import modules normally (`import { readFile } from 'fs-extra'` or `const { spawn } = require('child_process')`), and the testing framework transparently substitutes these mock implementations, allowing tests to verify behavior without system-level side effects.