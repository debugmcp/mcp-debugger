# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/contextlib.py
@source-hash: 8b7a477f978a8532
@generated: 2026-02-09T18:08:42Z

## Primary Purpose
Python standard library module providing utilities for context management via the `with` statement. Implements decorators, abstract base classes, and helper classes for both synchronous and asynchronous context managers as defined by PEP 343.

## Core Abstract Base Classes
- **AbstractContextManager (L17-36)**: ABC defining sync context manager protocol with `__enter__()` and `__exit__(exc_type, exc_value, traceback)` methods
- **AbstractAsyncContextManager (L39-59)**: ABC for async context managers with `__aenter__()` and `__aexit__(exc_type, exc_value, traceback)` methods

## Decorator Classes
- **ContextDecorator (L62-82)**: Mixin enabling context managers to work as function decorators via `_recreate_cm()` method
- **AsyncContextDecorator (L85-98)**: Async version that decorates async functions

## Generator-Based Context Managers
- **_GeneratorContextManagerBase (L101-123)**: Shared functionality for generator-based context managers, handles function wrapping and recreation
- **_GeneratorContextManager (L125-196)**: Implements sync context manager from generator function, complex exception handling in `__exit__()` with proper StopIteration/RuntimeError management
- **_AsyncGeneratorContextManager (L198-269)**: Async version using `anext()`, `athrow()`, and `aclose()` for proper async generator lifecycle

## Key Decorators
- **contextmanager (L272-302)**: Converts generator function to context manager, yields once for setup/cleanup pattern
- **asynccontextmanager (L305-335)**: Async version creating _AsyncGeneratorContextManager instances

## Utility Context Managers
- **closing (L338-360)**: Auto-closes objects with `.close()` method on exit
- **aclosing (L363-386)**: Async version calling `.aclose()` method
- **suppress (L429-465)**: Suppresses specified exceptions, includes BaseExceptionGroup handling (L460-464)
- **nullcontext (L761-785)**: No-op context manager for conditional context usage
- **chdir (L788-800)**: Changes working directory temporarily, non-thread-safe

## Stream Redirection
- **_RedirectStream (L389-404)**: Base class for stream redirection using sys attribute manipulation
- **redirect_stdout (L407-421)**: Redirects sys.stdout temporarily  
- **redirect_stderr (L423-426)**: Redirects sys.stderr temporarily

## Exit Stack Management
- **_BaseExitStack (L468-550)**: Shared functionality for managing callback stacks using `deque` for LIFO execution
- **ExitStack (L553-618)**: Sync version with complex exception chaining logic in `__exit__()` (L567-614)
- **AsyncExitStack (L622-758)**: Async version supporting mixed sync/async callbacks, sophisticated exception context management

## Key Dependencies
- `abc` for abstract base classes
- `functools.wraps` for decorator preservation
- `collections.deque` for callback stack storage
- `types.MethodType` for bound method creation
- `sys` for stream manipulation and exception info

## Critical Patterns
- Generator-based context managers follow setup→yield→cleanup pattern
- Exception propagation carefully preserves context chains and prevents suppression of wrong exceptions
- Exit stacks maintain LIFO order matching nested `with` statement behavior
- Async variants properly handle both sync and async callbacks in mixed scenarios

## Important Invariants
- Context managers must not raise exceptions in `__exit__` unless `__exit__` itself fails
- Generator context managers are one-shot and require recreation for reuse
- Exception identity checking prevents incorrect suppression (L163, L189)
- Stack unwinding preserves exception context chains for proper error reporting