# tests/unit/implementations/__mocks__/
@generated: 2026-02-11T23:47:31Z

## Purpose
Test mocks directory providing Jest/Vitest-compatible manual mocks for Node.js core modules and common libraries. Enables isolated unit testing by replacing real system interactions with controllable mock implementations.

## Key Components
- **child_process.js**: Mock for Node.js `child_process` module, providing Jest mock functions for `spawn` and `exec` operations
- **fs-extra.js**: Comprehensive mock for `fs-extra` filesystem library, covering file operations, directory management, path utilities, and JSON handling

## Architecture & Integration
Follows Jest/Vitest `__mocks__` directory convention for automatic mock resolution. When tests import the mocked modules (`child_process`, `fs-extra`), the testing framework automatically substitutes these mock implementations instead of the actual modules.

### Mock Patterns
- **Jest Integration**: `child_process.js` uses Jest's `jest.fn()` for creating mock functions
- **Vitest Integration**: `fs-extra.js` uses Vitest's `vi.fn()` for mock function creation
- **Import Compatibility**: `fs-extra` mock supports both named and default import patterns through dual export structure

## Public API Surface
### child_process Mock
- `spawn`: Mock function for subprocess spawning
- `exec`: Mock function for command execution

### fs-extra Mock
- **File Operations**: `readFile`, `writeFile`, `outputFile`
- **Directory Management**: `ensureDir`, `mkdir`, `rmdir`, `ensureDirSync`
- **Path Utilities**: `access`, `pathExists`, `existsSync`, `stat`
- **File Management**: `remove`, `unlink`, `copy`, `move`
- **Stream Operations**: `createReadStream`, `createWriteStream`
- **JSON Operations**: `outputJson`, `readJson`
- **Directory Listing**: `readdir`

## Testing Benefits
Eliminates external dependencies and side effects during testing by:
- Preventing actual process spawning in `child_process` operations
- Avoiding real filesystem interactions in `fs-extra` operations
- Providing predictable, controllable mock behavior for test assertions
- Enabling fast, reliable unit tests without environmental dependencies