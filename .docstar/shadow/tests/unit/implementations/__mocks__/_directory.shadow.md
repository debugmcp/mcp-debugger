# tests\unit\implementations\__mocks__/
@generated: 2026-02-12T21:00:53Z

## Purpose
Jest/Vitest `__mocks__` directory containing manual mock implementations for Node.js built-in modules and external libraries. This directory serves as a centralized location for test mocks that replace real dependencies with controllable test doubles during unit testing.

## Architecture
The directory follows Jest/Vitest conventions for automatic mock resolution:
- **Automatic Discovery**: Test frameworks automatically use mocks from `__mocks__` directories when the corresponding modules are imported in test files
- **Manual Mocks**: Each file provides a complete mock implementation of its corresponding real module
- **Isolation Strategy**: Prevents unit tests from executing actual system operations (subprocess spawning, filesystem I/O)

## Key Components

### Node.js Built-in Module Mocks
- **child_process.js**: Mocks Node.js subprocess operations (`spawn`, `exec`) with Jest mock functions, preventing actual process execution during tests

### External Library Mocks  
- **fs-extra.js**: Comprehensive mock of the fs-extra filesystem library with Vitest mock functions covering:
  - File operations (read, write, output)
  - Directory management (create, remove, ensure)
  - Path utilities (exists, access, stat)
  - Stream operations and JSON handling

## Public API Surface
Each mock file exports the same interface as its real counterpart:
- **child_process**: `spawn`, `exec` mock functions
- **fs-extra**: Complete API surface with 20+ mocked methods supporting both named and default import patterns

## Testing Integration
- **Framework Agnostic**: Supports both Jest (`jest.fn()`) and Vitest (`vi.fn()`) testing frameworks
- **Zero Configuration**: Automatic mock resolution requires no additional test setup
- **Predictable Behavior**: Replaces unpredictable system interactions with controllable mock functions
- **Side Effect Prevention**: Eliminates filesystem writes, subprocess spawning, and other system-level operations during testing

## Internal Organization
Mocks are organized by dependency type with each file providing a complete replacement for its corresponding module. The dual export pattern in fs-extra ensures compatibility with different import styles while maintaining API parity with the original libraries.