# tests/unit/implementations/__mocks__/
@generated: 2026-02-10T21:26:10Z

## Purpose
Mock implementations directory for Node.js built-in modules and external libraries used in unit testing. Provides controlled test doubles that isolate unit tests from external dependencies and system interactions.

## Components
- **child_process.js**: Jest mock for Node.js `child_process` module, replacing `spawn` and `exec` functions
- **fs-extra.js**: Vitest mock for `fs-extra` library with comprehensive filesystem operation mocking

## Architecture & Integration
Follows standard testing framework conventions for automatic mock resolution:
- Located in `__mocks__` directory for automatic Jest/Vitest discovery
- Provides drop-in replacements for real modules during test execution
- Exports maintain API compatibility with original modules

## Mock Capabilities
**Process Management**: Child process spawning and execution without creating actual subprocesses
**Filesystem Operations**: Complete filesystem API mocking including:
- File operations (read, write, output)
- Directory management (create, remove, ensure)
- Path utilities (access, exists, stat)
- Stream operations and JSON handling

## Usage Pattern
Automatically activated when corresponding modules are imported in test files. Tests can control mock behavior using Jest (`jest.fn()`) or Vitest (`vi.fn()`) mock utilities to verify calls and define return values.

## Testing Framework Support
- **Jest**: Native integration via manual mock pattern (child_process.js)
- **Vitest**: Full compatibility with vi.fn() mock functions (fs-extra.js)

## Data Flow
Import statements in test files → Framework mock resolution → Mock module loading → Controlled test execution without external dependencies