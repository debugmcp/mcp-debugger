# tests/fixtures/javascript-e2e/worker-helper.js
@source-hash: d7208a4669daac34
@generated: 2026-02-09T18:14:33Z

**Purpose**: Worker thread helper module for E2E multi-threaded testing scenarios using ES modules.

**Core Functionality**:
- `work()` function (L4-13): Main worker execution logic that computes a thread-specific value and communicates results
- Uses `threadId` to generate unique values per worker thread (base 100 + threadId)
- Handles dual communication modes: worker thread messaging vs. console output

**Key Components**:
- **Dependencies**: Node.js `worker_threads` module for `parentPort` and `threadId` (L2)
- **Communication Logic** (L8-12): Conditional result dispatch - uses `parentPort.postMessage()` for worker threads, falls back to `console.log()` for standalone execution
- **Debug Marker**: `// BREAK_HERE` comment at L6 indicates debugging/breakpoint location for testing tools

**Execution Flow**:
- Immediately invokes `work()` on module load (L15)
- Computes `value = 100 + threadId` (L6)
- Emits result via appropriate channel to prevent code optimization

**Testing Context**: 
- Designed for E2E testing frameworks that need predictable worker behavior
- Thread-safe value generation ensures distinguishable results across multiple workers
- ESM format supports modern Node.js worker thread testing scenarios