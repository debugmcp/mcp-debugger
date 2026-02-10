# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/unittest/_log.py
@source-hash: 905672317ab26c65
@generated: 2026-02-09T18:11:16Z

## Primary Purpose
Provides logging assertion utilities for unit testing, implementing context managers to capture and validate log output during test execution.

## Key Components

### _LoggingWatcher (L7-8)
Named tuple containing `records` (raw LogRecord objects) and `output` (formatted log messages). Acts as a data container for captured logging information.

### _CapturingHandler (L10-26)
Custom logging handler that captures all logging output for test assertions.
- **__init__ (L15-17)**: Initializes with empty _LoggingWatcher
- **emit (L22-25)**: Core method that appends both raw records and formatted messages to watcher
- **flush (L19-20)**: No-op implementation required by Handler interface

### _AssertLogsContext (L28-86)
Context manager for assertLogs() and assertNoLogs() test assertions, inheriting from _BaseTestCaseContext.

**Key attributes:**
- `LOGGING_FORMAT` (L31): Standard format string "%(levelname)s:%(name)s:%(message)s"
- `no_logs` (L41): Boolean flag distinguishing between assertLogs/assertNoLogs modes

**Core methods:**
- **__init__ (L33-41)**: Configures logger name, level (defaults to INFO), and assertion mode
- **__enter__ (L43-61)**: Sets up logging capture by:
  - Resolving logger by name or instance (L44-47)
  - Installing _CapturingHandler with specified level/format (L48-51)
  - Backing up and replacing existing handlers/settings (L53-58)
  - Returns watcher for assertLogs, nothing for assertNoLogs
- **__exit__ (L63-86)**: Restores original logger state (L64-66) and validates results:
  - assertNoLogs mode: Fails if any logs captured (L72-79)
  - assertLogs mode: Fails if no logs captured (L81-86)

## Dependencies
- `logging`: Standard library logging framework
- `collections`: For namedtuple creation
- `_BaseTestCaseContext`: Parent class providing test failure mechanisms

## Architectural Patterns
- Context manager protocol for resource management and cleanup
- Handler pattern extending logging.Handler
- State preservation pattern (backing up/restoring logger configuration)
- Dual-mode operation based on boolean flag

## Critical Invariants
- Logger state must be fully restored on context exit
- Handler replacement is atomic (complete list replacement, not modification)
- Level resolution handles both string names and integer values via `logging._nameToLevel`