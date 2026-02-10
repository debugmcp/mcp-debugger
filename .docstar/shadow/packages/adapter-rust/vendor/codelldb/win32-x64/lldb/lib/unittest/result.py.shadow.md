# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/unittest/result.py
@source-hash: 5db286bdd3821d64
@generated: 2026-02-09T18:11:23Z

## Purpose
Test result collection and management system for unittest framework in LLDB's testing infrastructure. Tracks test execution outcomes, captures output, manages failures/errors, and provides reporting capabilities.

## Core Components

### TestResult Class (L24-256)
Primary test result container that manages all aspects of test execution tracking:

**Key Attributes:**
- Test counters: `testsRun` (L42), collections for `failures` (L40), `errors` (L41), `skipped` (L43)
- Expected outcomes: `expectedFailures` (L44), `unexpectedSuccesses` (L45)
- Control flags: `failfast` (L39), `shouldStop` (L47), `buffer` (L48)
- Output capture: `_stdout_buffer`, `_stderr_buffer` (L50-51), original stream refs (L52-53)
- Performance tracking: `collectedDurations` (L46)

**Lifecycle Methods:**
- `startTestRun()` (L73-77): Pre-execution setup hook
- `startTest()` (L59-63): Per-test initialization, increments counter, sets up buffering
- `stopTest()` (L79-82): Per-test cleanup, restores stdout/stderr
- `stopTestRun()` (L105-109): Post-execution cleanup hook

**Result Recording Methods:**
- `addError()` (L112-117): Records unexpected exceptions with `@failfast` decorator
- `addFailure()` (L120-124): Records assertion failures with `@failfast` decorator  
- `addSuccess()` (L143-145): No-op success handler
- `addSkip()` (L147-149): Records skipped tests with reason
- `addExpectedFailure()` (L151-154): Records expected failures
- `addUnexpectedSuccess()` (L157-159): Records unexpected passes with `@failfast`
- `addSubTest()` (L126-141): Handles subtest results, routes to failures or errors
- `addDuration()` (L161-170): Collects timing data with compatibility check

**Output Management:**
- `_setupStdout()` (L65-71): Redirects stdout/stderr to StringIO buffers when `buffer=True`
- `_restoreStdout()` (L84-103): Restores original streams, optionally mirrors captured output
- Output formatting uses `STDOUT_LINE`/`STDERR_LINE` templates (L20-21)

**Exception Processing:**
- `_exc_info_to_string()` (L185-205): Converts sys.exc_info() to formatted string with optional output capture
- `_clean_tracebacks()` (L207-233): Removes unittest framework frames from tracebacks, handles chained exceptions
- `_is_relevant_tb_level()` (L235-236): Identifies unittest frames by `__unittest` global
- `_remove_unittest_tb_frames()` (L238-251): Truncates tracebacks at first unittest frame

**Utility Methods:**
- `wasSuccessful()` (L172-179): Returns True if no failures/errors/unexpected successes
- `stop()` (L181-183): Sets shouldStop flag for early termination
- `__repr__()` (L253-256): Summary representation with counts

### failfast Decorator (L12-18)
Decorator that calls `stop()` when `failfast` attribute is True, applied to error/failure recording methods.

## Dependencies
- `io`: StringIO for output buffering
- `sys`: Stream manipulation and exc_info()
- `traceback`: Exception formatting with TracebackException
- `util`: Class name utilities
- `functools.wraps`: Decorator preservation

## Architecture Notes
- Follows observer pattern - TestCase/TestSuite classes call result methods
- Buffer management allows output capture without affecting normal execution
- Traceback cleaning removes framework noise while preserving user code context
- Chained exception handling with cycle detection prevents infinite loops
- Failfast mechanism enables early test termination on first failure