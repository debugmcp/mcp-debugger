# tests/fixtures/javascript-e2e/worker.js
@source-hash: 84606082b487e6da
@generated: 2026-02-09T18:14:33Z

## Purpose
End-to-end test fixture for multi-threaded JavaScript debugging scenarios using Node.js worker threads with ESM modules.

## Core Functionality
- **Main worker thread (L1-25)**: Spawns and manages a child worker for testing multi-thread debugging capabilities
- **Worker initialization (L15)**: Creates Worker instance from `worker-helper.js` with module type support
- **Event handling (L16-25)**: Comprehensive worker lifecycle management with message, error, and exit event listeners

## Key Components
- **ESM compatibility setup (L6-8)**: Standard `__filename`/`__dirname` polyfill for ESM environments
- **Debug breakpoint (L12)**: `BREAK_HERE` comment indicates intentional debugger breakpoint location
- **Worker communication (L16-19)**: Message echo handler for verifying worker activity
- **Error handling (L20-22)**: Worker error event logging
- **Lifecycle monitoring (L23-25)**: Worker exit code tracking

## Dependencies
- `node:worker_threads` - Core Node.js worker thread functionality
- `node:url` - URL utilities for ESM module resolution
- `node:path` - Path manipulation utilities
- External worker module: `./worker-helper.js`

## Testing Context
This fixture appears designed for testing:
- Multi-threaded debugging scenarios
- ESM module worker thread creation
- Worker lifecycle event handling
- Cross-thread communication patterns

## Notable Patterns
- Uses `void` operator (L8, L13) to suppress unused variable warnings
- Employs URL constructor with `import.meta.url` for reliable module path resolution in ESM
- Includes explicit breakpoint marker for debugging test scenarios