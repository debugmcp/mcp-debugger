# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/doctest.py
@source-hash: 8fb954ef7e775270
@generated: 2026-02-09T18:07:19Z

## Primary Purpose
Python's standard doctest module - a framework for running and verifying code examples embedded in docstrings. This is a complete implementation shipped as part of Python's standard library that enables testing documentation examples automatically.

## Core Architecture (L110-127)
Four fundamental classes form the testing pipeline:
- **Example (L443-509)**: Represents a single `<source, want>` pair with metadata (line numbers, indentation, options)
- **DocTest (L511-582)**: Collection of Examples from a single docstring with context info (name, filename, line number)
- **DocTestFinder (L823-1154)**: Extracts DocTests from objects and their contained objects recursively
- **DocTestRunner (L1160-1615)**: Executes DocTests and accumulates statistics, handles output comparison

## Key Classes and Functions

### Option Flags (L131-160)
- `register_optionflag()` (L132-134): Dynamic flag registration system
- Pre-defined flags: `DONT_ACCEPT_TRUE_FOR_1`, `NORMALIZE_WHITESPACE`, `ELLIPSIS`, `SKIP`, `IGNORE_EXCEPTION_DETAIL`
- Reporting flags: `REPORT_UDIFF`, `REPORT_CDIFF`, `REPORT_NDIFF`, `REPORT_ONLY_FIRST_FAILURE`, `FAIL_FAST`

### DocTestParser (L588-816)
- `parse()` (L636-673): Main parsing method that splits strings into Examples and text
- Uses complex regex `_EXAMPLE_RE` (L597-608) to identify Python prompts and expected output
- `_EXCEPTION_RE` (L619-630): Handles expected exception patterns in doctest output
- `_find_options()` (L755-779): Extracts option directives from source comments

### DocTestFinder (L823-1154)
- `find()` (L854-954): Main entry point for discovering tests in objects
- `_find()` (L996-1055): Recursive worker that handles modules, classes, and functions
- `_from_module()` (L956-983): Determines if an object belongs to a specific module
- `_find_lineno()` (L1095-1154): Locates line numbers for docstrings in source code

### DocTestRunner (L1160-1615)
- `run()` (L1474-1542): Main execution method with stdout redirection and debugger integration
- `__run()` (L1311-1451): Core test execution loop with example processing
- `_SpoofOut` (L262-274): Custom StringIO subclass for capturing output
- `_OutputRedirectingPdb` (L360-395): Debugger integration for interactive testing

### OutputChecker (L1617-1761)
- `check_output()` (L1631-1691): Compares expected vs actual output with various normalization options
- `output_difference()` (L1717-1761): Generates detailed diff reports using difflib
- `_ellipsis_match()` (L277-324): Handles ellipsis pattern matching

## Test Functions (L913-2161)
- `testmod()` (L913-2015): Tests all docstrings in a module
- `testfile()` (L2017-2138): Tests examples in external text files
- `run_docstring_examples()` (L2140-2161): Tests specific object's docstring

## Unittest Integration (L2167-2561)
- `DocTestCase` (L2205-2366): Wraps DocTest as unittest.TestCase
- `DocTestSuite()` (L2391-2453): Converts module doctests to test suite
- `DocFileSuite()` (L2494-2561): Creates suite from doctest files

## Debugging Support (L2567-2699)
- `script_from_examples()` (L2567-2647): Converts doctest to executable Python script
- `debug()` (L2690-2699): Interactive debugging of specific doctests
- `DebugRunner` (L1801-1902): Raises exceptions instead of reporting failures

## Utility Functions
- `_extract_future_flags()` (L183-193): Extracts future import compiler flags
- `_normalize_module()` (L195-218): Resolves module references
- `_load_testfile()` (L224-240): Loads test files with proper encoding
- `_indent()` (L242-248): Adds indentation to text blocks

## Important Patterns
- Global `master` runner (L1911) for backwards compatibility
- Extensive use of regex for parsing Python interactive sessions
- Sophisticated output comparison with multiple normalization options
- Integration with Python's import system and introspection capabilities
- Support for both embedded doctests and standalone test files

## Critical Invariants
- Examples must end with newlines (enforced in Example.__init__)
- Source lines are normalized to remove common indentation
- Global namespace is copied for each doctest to ensure isolation
- Line numbers are 0-based relative to docstring start
- Exception handling preserves original tracebacks for debugging