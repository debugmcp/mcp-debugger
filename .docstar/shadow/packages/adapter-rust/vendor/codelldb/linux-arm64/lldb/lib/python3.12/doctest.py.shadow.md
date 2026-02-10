# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/doctest.py
@source-hash: 8fb954ef7e775270
@generated: 2026-02-09T18:08:59Z

## Primary Purpose & Responsibility

Python's doctest module: a framework for running executable examples embedded in docstrings and text files. Extracts Python code examples from docstrings, executes them, and verifies their output matches expected results.

## Core Architecture

Four fundamental classes orchestrate doctest execution:

1. **Example (L443-509)**: Represents a single `<source, want>` pair with metadata (lineno, indent, options, exc_msg)
2. **DocTest (L511-583)**: Collection of Examples with execution context (globs, name, filename, lineno, docstring)  
3. **DocTestFinder (L823-1154)**: Extracts DocTests from objects' docstrings via recursive traversal
4. **DocTestRunner (L1160-1616)**: Executes DocTest cases, captures output, compares results, accumulates statistics

## Key Classes & Functions

### Parsing & Discovery
- **DocTestParser (L588-817)**: Parses strings to extract doctest examples using regex patterns
  - `_EXAMPLE_RE` (L597-608): Matches PS1/PS2 prompts and expected output
  - `_EXCEPTION_RE` (L619-630): Handles expected exception patterns
  - `parse()` (L636-673): Main parsing entry point
- **DocTestFinder.find()** (L854-954): Recursively discovers doctests in modules/objects

### Execution Engine
- **DocTestRunner.run()** (L1474-1542): Main execution method with extensive stdout/pdb patching
- **DocTestRunner.__run()** (L1311-1451): Internal execution loop with outcome tracking
- **OutputChecker (L1617-1761)**: Compares expected vs actual output with various normalization options

### Output Comparison & Options
- **Option flags (L131-160)**: Configurable behavior (ELLIPSIS, NORMALIZE_WHITESPACE, SKIP, etc.)
- **_ellipsis_match()** (L277-324): Implements "..." wildcard matching algorithm
- **OutputChecker.check_output()** (L1631-1691): Multi-stage output comparison with option flag handling

### High-Level APIs
- **testmod()** (L913-2015): Tests all doctests in a module with comprehensive options
- **testfile()** (L2017-2138): Tests doctests from external files
- **run_docstring_examples()** (L2140-2161): Simplified API for single object testing

### Unittest Integration
- **DocTestCase (L2205-2367)**: Wraps DocTest as unittest.TestCase
- **DocTestSuite()** (L2391-2453): Creates unittest.TestSuite from module doctests
- **DocFileSuite()** (L2494-2561): Creates test suite from doctest files

### Debugging Support
- **DebugRunner (L1801-1902)**: Raises exceptions instead of reporting failures
- **_OutputRedirectingPdb (L360-394)**: Custom debugger with output redirection
- **script_from_examples()** (L2567-2647): Converts doctests to executable Python scripts

## Critical Dependencies

- `re`: Regex patterns for parsing PS1/PS2 prompts and exceptions
- `difflib`: Generates detailed diff output for failures  
- `inspect`: Object introspection and source code location
- `linecache`: Source line retrieval with custom patching for debugger
- `traceback`: Exception formatting and analysis
- `unittest`: Integration with standard testing framework

## Notable Patterns & Invariants

### Execution Context Management
- Comprehensive stdout/stderr/displayhook patching during test execution
- Debugger integration with linecache patching for interactive debugging
- Global namespace copying and cleanup to prevent test interference

### Option Flag System
- Bitwise flags control parsing, execution, and reporting behavior
- Flags can be set globally, per-runner, or per-example via `#doctest:` directives
- Hierarchical option precedence: global < runner < example-specific

### Error Handling Strategy
- Three execution outcomes: SUCCESS, FAILURE, BOOM (unexpected exception)
- Special handling for SyntaxError to filter implementation-specific details (L391-405)
- Exception message normalization with `IGNORE_EXCEPTION_DETAIL` flag

### File Path Resolution
- Module-relative path resolution with package support
- Loader-aware file reading for PEP 302 compatibility
- Cross-platform path normalization

## Architecture Constraints

- Examples must end with newlines (normalized in Example.__init__)
- PS1 prompts must be followed by spaces (validated in _check_prompt_blank)
- Indentation must be consistent within doctest blocks
- Global master runner instance for backwards compatibility (L1911)
- Special filename format `<doctest name[N]>` for debugger integration