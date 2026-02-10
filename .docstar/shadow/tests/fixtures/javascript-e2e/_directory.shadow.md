# tests/fixtures/javascript-e2e/
@generated: 2026-02-09T18:16:10Z

## Purpose and Responsibility
The `javascript-e2e` directory is a comprehensive test fixture suite specifically designed for end-to-end debugging scenarios across different JavaScript and TypeScript execution environments. It provides a standardized collection of minimal test cases for validating debugger functionality, breakpoint handling, and development tool integration.

## Key Components and Relationships

### Core Test Fixtures
- **`app.ts`**: TypeScript compilation and source map debugging fixture
- **`simple.js`**: Basic JavaScript ESM debugging with async/await patterns  
- **`async.js`**: Advanced async execution flow testing with Promise-based delays
- **`worker.js`** + **`worker-helper.js`**: Multi-threaded debugging scenarios using Node.js worker threads

### Common Testing Patterns
All fixtures implement standardized debugging markers using `BREAK_HERE` comments and specific breakpoint locations, enabling automated E2E test coordination. Each provides minimal, predictable execution flows ideal for testing:
- Breakpoint placement accuracy
- Variable inspection during debugging
- Async/await debugging workflows
- Source map generation and accuracy
- Multi-threaded debugging capabilities

## Public API Surface
The directory functions as a fixture library with multiple entry points:

### Primary Entry Points
- **`app.ts`**: TypeScript debugging workflow testing (requires compilation)
- **`simple.js`**: ESM-compatible single-threaded debugging
- **`async.js`**: Promise-based async debugging scenarios
- **`worker.js`**: Multi-threaded worker debugging (spawns `worker-helper.js`)

### Secondary Components
- **`worker-helper.js`**: Worker thread target module (not standalone)

## Internal Organization and Data Flow

### Execution Patterns
- **Synchronous flow**: `app.ts` (post-compilation)
- **Async single-thread**: `simple.js`, `async.js` 
- **Multi-threaded**: `worker.js` → `worker-helper.js` communication

### Data Flow Architecture
1. **Simple fixtures** (`simple.js`, `async.js`, `app.ts`): Linear execution with console output
2. **Worker scenario**: Parent-child thread communication via `postMessage`/message events
3. **Debugging integration**: Standardized breakpoint markers enable external debugger attachment

## Important Patterns and Conventions

### ESM Compatibility
- All JavaScript files support ESM execution environments
- `worker.js` includes ESM polyfills (`__filename`/`__dirname`)
- Top-level await usage in appropriate contexts

### Debug Testing Standards  
- Consistent `BREAK_HERE` comment placement at intended breakpoint locations
- Minimal complexity to ensure predictable debugging behavior
- Observable checkpoints via console output for verification

### Error Handling Patterns
- Process lifecycle management with explicit exit codes
- Worker thread error event handling
- Async error boundaries with try-catch blocks

## Integration Context
This fixture suite serves as a foundational testing resource for development tools, IDE integrations, and debugging frameworks requiring validation across diverse JavaScript execution scenarios including TypeScript compilation, ESM modules, async patterns, and multi-threaded environments.