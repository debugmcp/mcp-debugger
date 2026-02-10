# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/unittest/runner.py
@source-hash: 76d9beb9c21d0d36
@generated: 2026-02-09T18:12:28Z

## Purpose
Text-based unittest test runner implementation providing formatted console output for test execution results. Part of LLDB's vendored unittest framework for the CodeLLDB adapter.

## Core Classes

### _WritelnDecorator (L14-28)
Stream decorator that adds a `writeln()` method to file-like objects. Proxies all attributes to the wrapped stream except 'stream' and '__getstate__'. The `writeln()` method (L24-27) writes optional content followed by a newline, relying on text-mode stream translation for platform-appropriate line endings.

### TextTestResult (L30-161)
Extends `result.TestResult` to provide formatted text output during test execution. Key features:
- **Formatting constants**: `separator1` (70 '=' chars) and `separator2` (70 '-' chars) for visual separation
- **Constructor** (L38-47): Configures verbosity levels, descriptions, and optional durations tracking
- **Test description** (L49-54): Combines test name with docstring first line when descriptions enabled
- **Progress reporting**: 
  - `startTest()` (L56-62): Outputs test description in verbose mode
  - `_write_status()` (L64-75): Handles status output with proper indentation for subtests
- **Result handlers**: Methods for different test outcomes (success L92-98, error L100-106, failure L108-114, skip L116-122, expected failure L124-131, unexpected success L133-140)
- **Summary output**: 
  - `printErrors()` (L142-153): Outputs error/failure details and unexpected successes
  - `printErrorList()` (L155-161): Formats individual error entries with separators

### TextTestRunner (L164-291)
Main test runner class that orchestrates test execution and result reporting:
- **Configuration** (L172-191): Supports stream output, verbosity levels, fail-fast mode, output buffering, custom result classes, warning filters, traceback locals, and duration tracking
- **Result creation** (L193-200): Factory method `_makeResult()` with fallback for incompatible result classes
- **Duration reporting** (L202-222): `_printDurations()` shows slowest tests, with filtering for very fast tests in non-verbose mode
- **Main execution** (L224-291): `run()` method manages complete test lifecycle:
  - Result registration and configuration
  - Warning filter setup
  - Timing measurement using `time.perf_counter()`
  - Test execution with proper cleanup via try/finally
  - Comprehensive summary with counts for all result types
  - Status determination (FAILED/NO TESTS RAN/OK) with detailed breakdown

## Dependencies
- `sys`: For stderr default stream
- `time`: For performance timing via `perf_counter()`
- `warnings`: For warning filter management
- `.result`: Base TestResult class
- `.case._SubTest`: Subtest type detection
- `.signals.registerResult`: Result registration system

## Key Patterns
- **Verbosity-driven output**: Three modes (quiet/dots/verbose) control detail level
- **Stream abstraction**: All output goes through decorated stream for consistent formatting
- **Graceful degradation**: Fallback handling for result classes without duration support
- **Subtest awareness**: Special indentation and handling for hierarchical test structures