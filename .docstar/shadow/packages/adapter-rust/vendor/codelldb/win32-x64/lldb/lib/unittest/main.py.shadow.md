# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/unittest/main.py
@source-hash: db58280574389c0d
@generated: 2026-02-09T18:12:23Z

## Primary Purpose
Command-line unittest execution framework that provides the main program entry point for running Python unit tests. This module enables test discovery, argument parsing, and test execution with various configuration options.

## Key Components

### TestProgram Class (L57-289)
The main orchestrator class that handles the entire test execution lifecycle:
- **Constructor (L67-105)**: Initializes test program with module, test runner, loader, and execution options
- **parseArgs() (L126-153)**: Parses command-line arguments and configures test execution mode
- **createTests() (L155-165)**: Creates test suites either from discovery, module loading, or named tests
- **runTests() (L255-288)**: Executes tests using configured test runner and handles exit codes

### Utility Functions
- **_convert_name() (L31-45)**: Converts file paths to Python module names, handling cross-platform path separators
- **_convert_names() (L47-48)**: Batch conversion wrapper for multiple names
- **_convert_select_pattern() (L51-54)**: Adds wildcards to test name patterns for filtering

### Argument Parsing Infrastructure
- **_initArgParsers() (L167-170)**: Initializes the argument parser hierarchy
- **_getParentArgParser() (L172-208)**: Creates base parser with common options (verbosity, failfast, buffer, etc.)
- **_getMainArgParser() (L210-219)**: Creates parser for main execution mode
- **_getDiscoveryArgParser() (L221-240)**: Creates parser for test discovery mode
- **_do_discovery() (L242-253)**: Handles test discovery with configurable start directory and patterns

## Key Dependencies
- `argparse`: Command-line argument parsing
- `loader`: Test loading functionality (from same package)
- `runner`: Test execution and result reporting (from same package)
- `signals.installHandler`: Signal handling for graceful interruption

## Important Constants
- `_NO_TESTS_EXITCODE = 5` (L12): Exit code when no tests are found
- `MAIN_EXAMPLES` (L14-20): Usage examples for main execution mode
- `MODULE_EXAMPLES` (L22-29): Usage examples for module execution mode

## Architectural Patterns
- **Template Method**: TestProgram follows a structured execution flow: parse args → create tests → run tests
- **Strategy Pattern**: Configurable test runners and loaders can be injected
- **Factory Pattern**: Creates appropriate argument parsers based on execution mode

## Critical Behavior
- Supports both direct test specification and automatic discovery
- Handles module vs. file-based test identification with cross-platform path normalization
- Provides graceful fallback for test runner instantiation with different constructor signatures
- Exit codes: 0 (success), 1 (test failures), 5 (no tests found), 2 (usage errors)
- Automatic warning configuration when no explicit warning settings provided