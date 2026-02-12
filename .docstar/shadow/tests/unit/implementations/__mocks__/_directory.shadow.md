# tests\unit\implementations\__mocks__/
@generated: 2026-02-12T21:05:39Z

## Overall Purpose
Test mock directory providing manual mock implementations for external Node.js modules used in unit testing. Contains Jest and Vitest-compatible mocks that replace real module functionality with controllable test doubles, enabling isolated unit testing without external dependencies or side effects.

## Key Components
- **`child_process.js`**: Jest manual mock for Node.js child process operations (`spawn`, `exec`)
- **`fs-extra.js`**: Vitest manual mock for filesystem operations with comprehensive API coverage

## Mock Architecture Pattern
Both mocks follow the `__mocks__` directory convention used by Jest and Vitest testing frameworks:
- **Automatic Resolution**: Test frameworks automatically substitute these mocks when the corresponding modules are imported in test files
- **Isolation**: Prevents actual system calls (process spawning, filesystem operations) during testing
- **Controllability**: Provides mock functions that can be programmatically controlled and asserted against

## Public API Surface
The mocks expose the same interfaces as their target modules:

**Child Process Mock**:
- `spawn`: Mock replacement for spawning child processes
- `exec`: Mock replacement for executing shell commands

**Filesystem Mock**:
- **File Operations**: `readFile`, `writeFile`, `outputFile`
- **Directory Operations**: `ensureDir`, `mkdir`, `rmdir`, `ensureDirSync`
- **Path Utilities**: `access`, `pathExists`, `existsSync`, `stat`
- **File Management**: `remove`, `unlink`, `copy`, `move`
- **Stream Operations**: `createReadStream`, `createWriteStream`
- **JSON Operations**: `outputJson`, `readJson`
- **Directory Listing**: `readdir`

## Internal Organization
- **Framework Compatibility**: Mixed Jest (`vi.fn()`) and Vitest (`jest.fn()`) mock implementations
- **Import Patterns**: `fs-extra` mock supports both named and default import styles through dual export pattern
- **Mock Function Factory**: Utilizes testing framework mock function factories for consistent test behavior

## Testing Integration
Integrates seamlessly with unit test suites by providing drop-in replacements for external dependencies. Tests can focus on application logic without managing actual system resources, while maintaining the ability to verify interaction patterns with mocked modules.