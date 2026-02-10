# tests/unit/implementations/__mocks__/child_process.js
@source-hash: a269464b3fefed87
@generated: 2026-02-10T00:41:11Z

**Purpose**: Jest manual mock for Node.js `child_process` module used in unit testing.

**Exports (L5-8)**:
- `spawn` (L2,6): Jest mock function replacing `child_process.spawn`
- `exec` (L3,7): Jest mock function replacing `child_process.exec`

**Architecture**: Manual mock implementation that overrides Node.js built-in child process functionality during testing. Located in `__mocks__` directory following Jest conventions for automatic mock resolution.

**Usage Pattern**: Jest automatically uses this mock when `child_process` is imported in test files, allowing tests to mock subprocess execution without spawning actual processes.