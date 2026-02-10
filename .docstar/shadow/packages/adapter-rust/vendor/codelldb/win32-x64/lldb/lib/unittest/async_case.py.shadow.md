# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/unittest/async_case.py
@source-hash: b389b976f622c282
@generated: 2026-02-09T18:11:17Z

## IsolatedAsyncioTestCase - Asyncio-Enabled Unit Testing Framework

**Primary Purpose**: Extends unittest.TestCase to support async/await test methods while maintaining proper context variable isolation and sharing between setUp, test, and tearDown phases.

### Architecture Pattern
Uses a single long-running asyncio task approach rather than multiple `run_until_complete()` calls to preserve ContextVar state across test lifecycle methods. This ensures contextvars are shared between setUp(), test method, and tearDown() within the same task context.

### Key Components

**IsolatedAsyncioTestCase (L9-142)**: Main test case class inheriting from TestCase
- `_asyncioRunner`: AsyncioRunner instance for executing coroutines
- `_asyncioTestContext`: ContextVar context copied at initialization for isolation

**Lifecycle Management**:
- `__init__ (L35-38)`: Initializes runner and context variables
- `run (L128-133)`: Primary entry point, sets up runner before delegating to parent
- `debug (L135-138)`: Debug mode execution with runner lifecycle
- `__del__ (L140-142)`: Cleanup fallback for unclosed runners

**Async Test Hooks**:
- `asyncSetUp (L40-41)`: Async equivalent of setUp() - override in subclasses
- `asyncTearDown (L43-44)`: Async equivalent of tearDown() - override in subclasses
- `addAsyncCleanup (L46-59)`: Registers async cleanup functions
- `enterAsyncContext (L61-79)`: Async context manager helper with automatic cleanup

**Execution Engine**:
- `_callSetUp (L81-87)`: Executes sync setUp + asyncSetUp in proper context
- `_callTestMethod (L89-92)`: Handles test method execution with deprecation warnings
- `_callTearDown (L94-96)`: Executes asyncTearDown + sync tearDown
- `_callCleanup (L98-99)`: Cleanup function dispatcher
- `_callAsync (L101-107)`: Executes coroutines via runner with context
- `_callMaybeAsync (L109-117)`: Adaptive executor for sync/async functions

**Runner Management**:
- `_setupAsyncioRunner (L119-122)`: Creates AsyncioRunner with debug enabled
- `_tearDownAsyncioRunner (L124-126)`: Closes runner to prevent resource leaks

### Dependencies
- `asyncio`: Core async execution and Runner
- `contextvars`: Context variable isolation
- `inspect`: Coroutine function detection
- `warnings`: Deprecation warnings for test return values
- `.case.TestCase`: Parent unittest class

### Critical Constraints
- Runner must be initialized before any async operations
- Context variables are isolated per test instance but shared within test lifecycle
- All async operations must run through the same runner instance
- Test methods should not return non-None values (deprecated behavior)

### Usage Pattern
Subclass IsolatedAsyncioTestCase, override asyncSetUp/asyncTearDown as needed, and write async test methods. The framework handles runner lifecycle and context management automatically.