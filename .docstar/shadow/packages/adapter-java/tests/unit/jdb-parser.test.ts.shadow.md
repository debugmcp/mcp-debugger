# packages/adapter-java/tests/unit/jdb-parser.test.ts
@source-hash: 3455680087c01b85
@generated: 2026-02-09T18:13:55Z

## Test Suite for JDB Parser

**Primary Purpose**: Comprehensive unit tests for `JdbParser` class methods that parse Java Debugger (jdb) command output into structured data.

**Core Functionality Tested**:

### Parser Methods Under Test

**parseStoppedEvent (L5-45)**: Tests parsing of debugger stopped events
- Breakpoint hits with quoted/unquoted thread names (L6-28)
- Step completion events (L30-38) 
- Handles non-matching output gracefully (L40-44)

**parseStackTrace (L47-78)**: Tests stack frame parsing from `where` command output
- Extracts frame ID, class/method names, file, and line numbers (L48-71)
- Handles native methods correctly (L64-67)
- Returns empty array for invalid input (L73-77)

**parseLocals (L80-144)**: Tests local variable parsing from debugger output
- Primitive types (int, String, boolean) with type inference (L81-107)
- Object instances with expandable flag and object IDs (L109-129)
- Null value handling (L131-143)

**parseThreads (L146-171)**: Tests thread list parsing with group organization
- Extracts thread ID, name, group, and state (L147-170)

**Utility Method Tests**:
- **isPrompt (L173-187)**: Recognizes debugger prompts (`main[1]`, `>`)
- **extractPrompt (L189-199)**: Extracts prompt from output strings
- **isVMStarted (L201-210)**: Detects VM initialization messages
- **isTerminated (L212-222)**: Identifies application termination
- **parseError (L224-242)**: Extracts error messages from jdb output
- **parseBreakpointSet (L244-259)**: Confirms breakpoint creation
- **parseBreakpointCleared (L261-270)**: Confirms breakpoint removal

**Test Patterns**:
- Uses multiline string templates for realistic jdb output simulation
- Consistently tests both positive cases and edge cases (non-matching input)
- Validates complex object structures with nested properties
- Tests type inference and data transformation logic

**Dependencies**:
- Vitest testing framework (L1)
- JdbParser from `../../src/utils/jdb-parser.js` (L2)

**Key Data Structures Validated**:
- Stopped events with reason, thread, and location info
- Stack frames with class/method breakdown
- Variables with type detection and expandability
- Thread objects with state and group membership
- Error parsing with descriptive messages