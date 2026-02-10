# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/doctest.py
@source-hash: 8fb954ef7e775270
@generated: 2026-02-09T18:07:53Z

## Purpose

Python's doctest module - a comprehensive framework for extracting, parsing, and executing examples embedded in docstrings for testing purposes. Provides both standalone testing capabilities and unittest integration.

## Core Architecture

The module follows a 4-class design pattern:
- **Example (L443-510)**: Stores a single test case with source code, expected output, and metadata
- **DocTest (L511-582)**: Collection of Examples with execution context and location information  
- **DocTestFinder (L823-1154)**: Extracts DocTests from objects' docstrings recursively
- **DocTestRunner (L1160-1615)**: Executes DocTest cases and accumulates statistics

## Key Classes

### Example (L443-510)
Represents a single doctest example with:
- `source`: Python code to execute 
- `want`: Expected output
- `exc_msg`: Expected exception message (if any)
- `lineno`, `indent`: Position metadata
- `options`: Per-example option flags

### DocTest (L511-582) 
Container for related examples with shared namespace:
- `examples`: List of Example objects
- `globs`: Execution globals dictionary
- `name`, `filename`, `lineno`: Source location info
- `docstring`: Original docstring text

### DocTestParser (L588-817)
Parses docstrings to extract examples using regex patterns:
- `_EXAMPLE_RE (L597)`: Main regex for finding doctest examples
- `_EXCEPTION_RE (L619)`: Regex for parsing exception output
- `parse()` method extracts Examples and intervening text
- `get_doctest()` creates DocTest objects from strings

### DocTestFinder (L823-1154)
Discovers doctests in Python objects:
- Recursively searches modules, classes, functions, methods
- Handles `__test__` dictionaries for explicit test inclusion
- Filters objects by module membership
- `find()` method returns list of DocTest objects

### DocTestRunner (L1160-1615)
Executes doctests and reports results:
- `run()` method executes all examples in a DocTest
- Captures stdout/stderr during execution
- Compares actual vs expected output using OutputChecker
- Provides detailed failure reporting with diffs
- Supports debugging integration with custom pdb class

### OutputChecker (L1617-1761)
Handles output comparison with configurable matching:
- ASCII conversion for unicode compatibility
- Special handling for boolean/integer equivalence  
- Blank line normalization with `<BLANKLINE>` marker
- Whitespace normalization and ellipsis matching
- Multiple diff formats (unified, context, ndiff)

## Option Flags System

Flag-based configuration system (L131-160):
- **Comparison flags**: Control output matching behavior
- **Reporting flags**: Control failure output format  
- `register_optionflag()` creates new flags dynamically
- Per-example options via `#doctest:` directives

## High-Level Functions

### testmod() (L913-2015)
Primary entry point for testing modules:
- Auto-discovers doctests in module objects
- Supports verbose output and custom option flags
- Returns (failures, tests_run) tuple
- Maintains global `master` runner for result aggregation

### testfile() (L2017-2138) 
Tests doctests in standalone text files:
- Supports module-relative and absolute file paths
- Custom encoding support for file reading
- Integration with global test runner

### run_docstring_examples() (L2140-2161)
Simplified interface for testing single objects' docstrings without recursion.

## Unittest Integration (L2164-2561)

- **DocTestCase (L2205)**: Wraps DocTest as unittest.TestCase
- **DocTestSuite()**: Converts module doctests to test suite
- **DocFileSuite()**: Creates test suite from doctest files
- **DebugRunner (L1801)**: Raises exceptions instead of reporting for debugging

## Debugging Support (L2563-2699)

- `script_from_examples()`: Converts doctests to executable Python script
- `debug()`, `debug_src()`: Interactive debugging of failing tests
- `testsource()`: Extracts test source code for analysis
- Custom `_OutputRedirectingPdb` class for proper I/O handling during debugging

## Special Features

- **Ellipsis matching**: `...` wildcard in expected output
- **Exception testing**: Compare exception messages and types
- **Future imports**: Automatic detection and compilation flag handling
- **Module-relative paths**: Flexible file loading system
- **Incremental newline decoding**: Proper cross-platform text handling