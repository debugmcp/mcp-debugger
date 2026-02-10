# tests/unit/implementations/__mocks__/child_process.js
@source-hash: a269464b3fefed87
@generated: 2026-02-09T18:14:19Z

## Purpose
Jest manual mock for Node.js `child_process` module, replacing native process spawning functions with controllable test doubles for unit testing.

## Mock Functions
- **spawn** (L2, L6): Jest mock function replacing `child_process.spawn()` for testing process creation
- **exec** (L3, L7): Jest mock function replacing `child_process.exec()` for testing command execution

## Architecture
Simple module export pattern providing Jest mocks for the two primary child process creation methods. This mock allows tests to:
- Verify process spawning calls without actually creating processes
- Control return values and simulate process behaviors
- Test error conditions and edge cases safely

## Usage Context
Located in `__mocks__` directory following Jest's manual mock convention. Automatically used when `child_process` is imported in test files within the same directory structure.