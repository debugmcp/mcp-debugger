# packages/adapter-java/tests/unit/jdb-parser.test.ts
@source-hash: 3455680087c01b85
@generated: 2026-02-10T00:41:09Z

## Unit Test Suite for JdbParser

**Primary Purpose**: Comprehensive test suite for `JdbParser` class, validating Java Debugger (JDB) output parsing functionality across multiple debugging scenarios.

**Dependencies**:
- `vitest` testing framework (L1)
- `JdbParser` from `../../src/utils/jdb-parser.js` (L2)

### Test Coverage Overview

**Stopped Event Parsing (L5-45)**:
- `parseStoppedEvent()` method validation
- Breakpoint hits with quoted/unquoted thread names (L6-28)
- Step completion events (L30-38)
- Non-matching output handling (L40-44)

**Stack Trace Parsing (L47-78)**:
- `parseStackTrace()` method testing
- Frame extraction with line numbers, class/method names (L48-71)
- Native method handling (L64-67)
- Empty result scenarios (L73-77)

**Local Variables Parsing (L80-144)**:
- `parseLocals()` method comprehensive testing
- Primitive types: int, String, boolean (L81-107)
- Object instances with IDs and expandable properties (L109-129)
- Null value handling (L131-143)

**Thread Management (L146-171)**:
- `parseThreads()` method validation
- Thread groups and states parsing (L147-170)
- Thread ID extraction and state detection

**JDB Prompt Detection (L173-199)**:
- `isPrompt()` method testing main/simple prompts (L173-187)
- `extractPrompt()` output processing (L189-199)

**VM State Detection (L201-222)**:
- `isVMStarted()` VM initialization detection (L201-210)
- `isTerminated()` application exit/disconnection detection (L212-222)

**Error Handling (L224-242)**:
- `parseError()` method testing
- Breakpoint setting failures (L225-229)
- Class not found errors (L231-235)
- Non-error output distinction (L237-241)

**Breakpoint Operations (L244-270)**:
- `parseBreakpointSet()` confirmation parsing (L244-259)
- `parseBreakpointCleared()` removal detection (L261-270)

### Key Testing Patterns

- **Null safety**: Extensive null checking for failed parsing scenarios
- **Multi-format support**: Tests handle various JDB output formats (quoted vs unquoted, different prompt styles)
- **Type inference**: Variable type detection from JDB output patterns
- **Object expansion**: Tests verify expandable object detection with ID extraction
- **State machine validation**: VM lifecycle state transitions thoroughly tested

### Architecture Notes

- All tests follow AAA pattern (Arrange, Act, Assert)
- Comprehensive edge case coverage including malformed inputs
- Mock JDB output strings simulate real debugger scenarios
- Parser methods expected to return structured objects or null for invalid input