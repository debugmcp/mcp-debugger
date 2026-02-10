# examples/javascript/typescript_test.js
@source-hash: e0e43576cca0db90
@generated: 2026-02-10T01:19:00Z

**Primary Purpose:** Transpiled JavaScript test file for MCP debugger testing, focused on TypeScript debugging scenarios including source maps, breakpoints, and variable inspection.

**Key Components:**

- `__awaiter` helper (L6-14): TypeScript's async/await transpilation helper for Promise-based operations
- `__generator` helper (L15-41): TypeScript's generator/yield transpilation helper for async state machines

**Core Classes:**

- `Calculator` (L43-61): Test class for stepping through methods
  - Constructor initializes empty `history` array (L44-46)
  - `add(a, b)` method with breakpoint marker at L48 (original TS line 18)
  - `multiply(a, b)` method with breakpoint marker at L53 (original TS line 23)
  - `getHistory()` returns calculation history array (L57-59)

**Key Functions:**

- `swap<T>(a, b)` (L63-69): Generic function testing with breakpoint at L65 (original TS line 36)
  - Logs before/after states, returns tuple `[b, a]`
  
- `fetchData(id)` (L71-92): Async function using `__awaiter` and `__generator` 
  - Simulates 100ms delay, creates person objects with computed properties
  
- `main()` (L94-167): Main test orchestrator with comprehensive debugging scenarios:
  - Test 1: Calculator class instantiation and method calls (L102-107)
  - Test 2: Generic swap function with numbers and strings (L109-113)
  - Test 3: Sequential async operations with fetchData (L115-122)
  - Test 4: Complex nested data structures (todos array) with iteration breakpoint at L149 (original TS line 119)
  - Test 5: Error handling with stack trace testing (L156-161), breakpoint at L160 (original TS line 129)

- `throwTestError()` (L168-170): Utility function for error testing

**Architectural Notes:**

- File contains extensive TypeScript transpilation artifacts (__awaiter, __generator)
- Comments reference original TypeScript line numbers for breakpoint mapping
- Source map reference at L173 enables debugging original TypeScript source
- Designed for comprehensive debugger testing across async, OOP, generics, and error scenarios

**Dependencies:** None (standalone test file)

**Execution:** Self-executing via `main().catch(console.error)` at L172