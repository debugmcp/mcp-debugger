# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/unittest/result.py
@source-hash: 5db286bdd3821d64
@generated: 2026-02-09T18:06:18Z

## Purpose
Core test result aggregation and reporting component for Python's unittest framework. Manages test execution state, collects outcomes (successes, failures, errors, skips), and handles output buffering with traceback formatting.

## Key Components

### failfast Decorator (L12-18)
Function decorator that automatically stops test execution when `failfast` attribute is True. Applied to methods that record test failures/errors to enable early termination.

### TestResult Class (L24-256)
Primary test result collector with comprehensive state tracking:

**Core State Attributes (L38-54):**
- `failures[]`, `errors[]`, `skipped[]` - Collections of (test, info) tuples
- `expectedFailures[]`, `unexpectedSuccesses[]` - Expected outcome tracking  
- `testsRun` - Counter for executed tests
- `shouldStop`, `failfast` - Execution control flags
- `buffer`, `tb_locals` - Output capture and traceback detail controls
- Stream management: `_stdout_buffer`, `_stderr_buffer`, originals

**Test Lifecycle Methods:**
- `startTestRun()` (L73-77) - Called once before all tests
- `startTest(test)` (L59-63) - Per-test initialization, increments counter, sets up buffering
- `stopTest(test)` (L79-82) - Per-test cleanup, restores output streams
- `stopTestRun()` (L105-109) - Called once after all tests

**Result Recording Methods (All decorated with @failfast):**
- `addError(test, err)` (L112-117) - Records exceptions/errors
- `addFailure(test, err)` (L120-124) - Records assertion failures
- `addSubTest(test, subtest, err)` (L126-141) - Handles subtest outcomes
- `addSuccess(test)` (L143-145) - Records successful tests (no-op)
- `addSkip(test, reason)` (L147-149) - Records skipped tests
- `addExpectedFailure(test, err)` (L151-154) - Records expected failures
- `addUnexpectedSuccess(test)` (L157-159) - Records unexpected passes
- `addDuration(test, elapsed)` (L161-170) - Records timing information

**Output Management:**
- `_setupStdout()` (L65-71) - Redirects stdout/stderr to buffers when buffering enabled
- `_restoreStdout()` (L84-103) - Restores original streams, optionally mirrors captured output

**Analysis & Formatting:**
- `wasSuccessful()` (L172-179) - Returns True if no failures/errors/unexpected successes
- `_exc_info_to_string(err, test)` (L185-205) - Converts exception tuples to formatted strings with optional captured output
- `_clean_tracebacks(exctype, value, tb, test)` (L207-233) - Filters unittest framework frames from tracebacks, handles chained exceptions
- `_is_relevant_tb_level(tb)` (L235-236) - Identifies unittest framework frames via `__unittest` global
- `_remove_unittest_tb_frames(tb)` (L238-251) - Truncates user tracebacks at first unittest frame

## Key Dependencies
- `io.StringIO` for output buffering
- `traceback.TracebackException` for exception formatting  
- `sys.exc_info()` format for exception handling
- `util.strclass()` for class name formatting

## Architectural Patterns
- Observer pattern: TestResult receives notifications about test events
- Decorator pattern: `@failfast` adds early termination behavior
- State management: Comprehensive tracking of all test outcomes and execution state
- Output isolation: Buffering system prevents test output interference

## Critical Invariants
- `testsRun` incremented exactly once per `startTest()` call
- Buffered streams properly restored after each test
- Exception chaining handled without infinite loops (via `seen` set)
- Failfast behavior applied consistently to failure-recording methods