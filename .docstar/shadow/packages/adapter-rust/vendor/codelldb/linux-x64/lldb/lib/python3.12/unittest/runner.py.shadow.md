# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/unittest/runner.py
@source-hash: 76d9beb9c21d0d36
@generated: 2026-02-09T18:06:19Z

## Purpose
Core unittest test runner implementation providing text-based output formatting for test execution results. Handles test result display, progress indication, and summary reporting.

## Key Classes

### _WritelnDecorator (L14-28)
Stream wrapper adding `writeln` convenience method to file-like objects. Proxies all attributes to wrapped stream except 'stream' and '__getstate__'. Used to add newline functionality to output streams.

### TextTestResult (L30-162)
Main test result collector and formatter extending `result.TestResult`. Manages real-time test output display based on verbosity levels:
- `separator1/separator2` (L35-36): Visual separators for error sections
- `showAll` (L43): Verbose mode (verbosity > 1) shows full test descriptions
- `dots` (L44): Dot mode (verbosity == 1) shows progress dots
- `durations` (L47): Optional test timing collection

Key methods:
- `getDescription()` (L49-54): Formats test names with optional docstrings
- `startTest()` (L56-62): Initiates test display in verbose mode
- `_write_status()` (L64-75): Core status writing with subtest indentation
- `addSubTest()` (L77-90): Handles subtest results with proper formatting
- Result handlers (L92-140): `addSuccess`, `addError`, `addFailure`, `addSkip`, `addExpectedFailure`, `addUnexpectedSuccess`
- `printErrors()` (L142-153): Summary error reporting
- `printErrorList()` (L155-161): Detailed error output formatting

### TextTestRunner (L164-292)
Primary test runner orchestrating test execution and output. Configures result collection and manages test lifecycle:

**Configuration** (L172-191):
- Stream output (defaults to stderr)
- Verbosity levels, failure modes, buffering
- Result class customization
- Warning handling and duration tracking

**Key methods**:
- `_makeResult()` (L193-200): Factory for result objects with backward compatibility
- `_printDurations()` (L202-222): Post-run performance reporting
- `run()` (L224-292): Main execution method handling:
  - Result registration and configuration
  - Warning context management
  - Test timing (L235, L245)
  - Lifecycle hooks (`startTestRun`/`stopTestRun`)
  - Summary statistics and status reporting

## Dependencies
- `result`: Base TestResult classes
- `case._SubTest`: Subtest handling
- `signals.registerResult`: Result registration for cleanup
- Standard library: `sys`, `time`, `warnings`

## Architecture Patterns
- **Decorator Pattern**: `_WritelnDecorator` extends stream functionality
- **Template Method**: Result class methods follow consistent override pattern
- **Factory Pattern**: `_makeResult()` creates customizable result instances
- **Strategy Pattern**: Different verbosity modes change output behavior

## Critical Behavior
- Output formatting varies significantly by verbosity level
- Backward compatibility handling in `_makeResult()` for duration parameter
- Proper stream flushing ensures real-time output
- Subtest indentation (2 spaces) distinguishes from main tests
- Duration filtering hides sub-millisecond tests in low verbosity