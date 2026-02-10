# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/unittest/case.py
@source-hash: 45bac6d80a4fc3a0
@generated: 2026-02-09T18:11:25Z

**Primary Purpose**: Core unittest framework implementation providing TestCase class and related utilities for unit testing in Python. Contains the main test case execution logic, assertion methods, context managers for exception/warning testing, and test result handling.

**Key Classes and Functions**:

**Exception Classes (L26-43)**:
- `SkipTest (L26-33)`: Exception to skip test execution
- `_ShouldStop (L34-38)`: Internal exception to halt test execution
- `_UnexpectedSuccess (L39-43)`: Exception when expected failure succeeds

**Test Execution Management**:
- `_Outcome (L45-84)`: Manages test execution state and result handling, tracks success/failure and expected failures
- `_Outcome.testPartExecutor (L53-84)`: Context manager for executing test parts with proper exception handling
- `_addSkip/_addError (L86-101)`: Helper functions for adding test results with backward compatibility

**Context Management**:
- `_enter_context (L106-119)`: Generic context manager entry helper
- Module-level cleanup functions `addModuleCleanup/doModuleCleanups (L122-146)`: Module-wide cleanup registration and execution

**Test Decorators (L148-187)**:
- `skip/skipIf/skipUnless (L148-183)`: Decorators for conditional test skipping
- `expectedFailure (L184-187)`: Marks tests expected to fail

**Assertion Context Managers**:
- `_BaseTestCaseContext (L193-201)`: Base class for assertion contexts
- `_AssertRaisesContext (L244-281)`: Context manager for assertRaises functionality
- `_AssertWarnsContext (L283-333)`: Context manager for assertWarns functionality

**Core TestCase Class (L345-1362)**:
- Main test case implementation with comprehensive assertion methods
- `__init__ (L394-425)`: Initializes test method name, cleanup handlers, and type-specific equality functions
- `setUp/tearDown (L468-474)`: Test fixture setup/teardown hooks
- `run (L599-663)`: Main test execution method handling setup, test method execution, teardown, and result reporting
- `subTest (L520-550)`: Context manager for creating subtests within a test method

**Assertion Methods (L717-1362)**:
Comprehensive set of assertion methods including:
- Basic assertions: `assertTrue/assertFalse (L717-728)`
- Equality: `assertEqual/assertNotEqual (L880-895)`
- Numeric comparisons: `assertAlmostEqual/assertNotAlmostEqual (L896-975)`
- Container comparisons: `assertSequenceEqual/assertListEqual/assertTupleEqual/assertSetEqual (L976-1146)`
- Identity/membership: `assertIs/assertIsNot/assertIn/assertNotIn (L1147-1173)`
- Type checking: `assertIsInstance/assertNotIsInstance (L1289-1301)`
- Exception/warning testing: `assertRaises/assertWarns/assertRaisesRegex/assertWarnsRegex (L750-1336)`

**Specialized TestCase Classes**:
- `FunctionTestCase (L1365-1421)`: Wraps standalone test functions into TestCase interface
- `_SubTest (L1423-1456)`: Represents subtests created within main test methods

**Key Dependencies**:
- `result` module for TestResult handling
- `util` module for string formatting and representation utilities
- Standard library modules: sys, functools, difflib, warnings, collections, contextlib, traceback, time, types

**Architectural Patterns**:
- Extensive use of context managers for resource management and exception handling
- Type-specific equality functions registered via `addTypeEqualityFunc (L426-440)`
- Cleanup mechanism using LIFO stack for both instance and class-level cleanup
- Outcome-based execution tracking separating test logic from result reporting
- Backward compatibility handling for older TestResult implementations

**Critical Invariants**:
- Test methods should not return non-None values (deprecated, L588-592)
- Cleanup functions always execute even if setup fails
- Reference cycles explicitly broken to prevent memory leaks (L240-242, L651-654, L780-781)
- maxDiff controls diff output truncation (L382, L1075-1079)