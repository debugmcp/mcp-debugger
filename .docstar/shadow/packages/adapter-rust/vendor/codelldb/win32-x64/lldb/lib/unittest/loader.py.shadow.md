# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/unittest/loader.py
@source-hash: 7f0af414bfa7fe86
@generated: 2026-02-09T18:11:24Z

## Purpose
Core unittest test discovery and loading infrastructure for Python's unittest framework. This module provides the `TestLoader` class that discovers, loads, and organizes test cases from various sources (modules, classes, names, directories) into executable test suites.

## Key Classes and Functions

### _FailedTest (L22-35)
Special TestCase subclass that represents a test that failed to load properly. Dynamically creates a test method that re-raises the original exception when executed.

### TestLoader (L63-451)
Primary class responsible for test discovery and loading. Key attributes:
- `testMethodPrefix = 'test'` (L68) - prefix for identifying test methods
- `sortTestMethodsUsing` (L69) - sorting function for test method ordering
- `testNamePatterns` (L70) - pattern matching for selective test execution
- `suiteClass` (L71) - class used to create test suites
- `errors` (L76) - accumulates loading errors
- `_loading_packages` (L79) - prevents infinite recursion during package loading

### Core Loading Methods
- `loadTestsFromTestCase(testCaseClass)` (L81-95) - Creates suite from all test methods in a TestCase class
- `loadTestsFromModule(module, *, pattern=None)` (L97-119) - Loads all TestCase classes from a module, respects `load_tests` hook
- `loadTestsFromName(name, module=None)` (L121-201) - Resolves dotted names to test objects with sophisticated error handling
- `loadTestsFromNames(names, module=None)` (L203-208) - Batch version of loadTestsFromName

### Discovery System
- `discover(start_dir, pattern='test*.py', top_level_dir=None)` (L229-312) - Main discovery entry point with recursive directory traversal
- `_find_tests(start_dir, pattern)` (L346-376) - Generator that yields discovered test suites
- `_find_test_path(full_path, pattern)` (L378-450) - Handles individual file/directory discovery logic

### Utility Functions
- `getTestCaseNames(testCaseClass)` (L210-227) - Extracts and filters test method names with pattern matching support
- `_get_name_from_path(path)` (L326-336) - Converts filesystem paths to Python module names
- `_get_module_from_name(name)` (L338-340) - Safely imports modules by name

## Error Handling Infrastructure
Several helper functions create special test cases for different failure scenarios:
- `_make_failed_import_test(name, suiteClass)` (L37-40) - Import failures
- `_make_failed_load_tests(name, exception, suiteClass)` (L42-45) - load_tests hook failures  
- `_make_failed_test(methodname, exception, suiteClass, message)` (L47-49) - General test creation failures
- `_make_skipped_test(methodname, exception, suiteClass)` (L51-57) - Skipped tests from SkipTest exceptions

## Global Objects
- `defaultTestLoader = TestLoader()` (L453) - Default shared instance
- `VALID_MODULE_NAME` (L19) - Regex pattern for valid Python module filenames

## Dependencies
- Standard library: `os`, `sys`, `re`, `traceback`, `types`, `functools`, `fnmatch`
- Internal unittest modules: `case`, `suite`, `util`

## Deprecated Functions (L459-497)
Legacy functions `_makeLoader`, `getTestCaseNames`, `makeSuite`, `findTestCases` marked for removal in Python 3.13, replaced by TestLoader methods.

## Architectural Notes
- Uses recursive directory traversal with package-aware loading
- Supports `load_tests` protocol for custom test loading
- Implements sophisticated name resolution with fallback error reporting  
- Prevents infinite recursion during package discovery via `_loading_packages` tracking
- Maintains sys.path manipulation for proper module importing during discovery