# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/contextlib.py
@source-hash: 8b7a477f978a8532
@generated: 2026-02-09T18:07:07Z

## Purpose
Python's standard library contextlib module providing utilities for with-statement context managers as defined by PEP 343. Implements both synchronous and asynchronous context manager abstractions, decorators, and helper utilities.

## Key Components

### Abstract Base Classes
- **AbstractContextManager (L17-36)**: ABC defining `__enter__()` and `__exit__()` protocols, with `__subclasshook__()` for duck typing support
- **AbstractAsyncContextManager (L39-59)**: Async equivalent with `__aenter__()` and `__aexit__()` protocols

### Decorator Mixins
- **ContextDecorator (L62-83)**: Mixin enabling context managers to work as decorators via `_recreate_cm()` method
- **AsyncContextDecorator (L85-98)**: Async version supporting coroutine functions

### Generator Context Manager Implementation
- **_GeneratorContextManagerBase (L101-123)**: Shared base for generator-based context managers, handles generator lifecycle and docstring propagation
- **_GeneratorContextManager (L125-196)**: Synchronous implementation with complex exception handling in `__exit__()` for proper StopIteration/RuntimeError semantics per PEP 479
- **_AsyncGeneratorContextManager (L198-269)**: Async equivalent handling StopAsyncIteration and athrow() protocol

### Decorator Functions
- **contextmanager (L272-302)**: Decorator converting generator functions to context managers
- **asynccontextmanager (L305-335)**: Async version for async generator functions

### Utility Context Managers
- **closing (L338-361)**: Auto-closes objects with `.close()` method
- **aclosing (L363-386)**: Async version calling `.aclose()` method
- **suppress (L429-465)**: Suppresses specified exception types, includes BaseExceptionGroup handling (L460-464)
- **nullcontext (L761-785)**: No-op context manager for conditional context usage

### Stream Redirection
- **_RedirectStream (L389-405)**: Base class for stream redirection with re-entrant stack management
- **redirect_stdout (L407-421)**: Redirects sys.stdout temporarily
- **redirect_stderr (L423-426)**: Redirects sys.stderr temporarily

### Exit Stack Management
- **_BaseExitStack (L468-550)**: Shared functionality for managing callback stacks with LIFO execution
- **ExitStack (L553-618)**: Synchronous stack manager with complex exception context preservation (L573-585)
- **AsyncExitStack (L622-758)**: Async version supporting both sync and async callbacks, handles mixed callback types

### Directory Management
- **chdir (L788-800)**: Changes current working directory with automatic restoration

## Critical Patterns

### Exception Handling Protocol
Generator context managers implement sophisticated exception propagation:
- Normal exit: generator must complete (raise StopIteration)
- Exception exit: uses `throw()`/`athrow()` to send exceptions to generator
- Identity checking prevents suppression of re-raised exceptions
- PEP 479 compliance for StopIteration wrapping in RuntimeError

### Stack Management
ExitStack classes maintain LIFO callback execution with proper exception chaining, ensuring nested context manager behavior even for dynamic registration.

## Dependencies
- **abc**: Abstract base class definitions
- **sys**: Exception info and stream access
- **os**: File system operations for chdir
- **collections.deque**: Efficient callback stack storage
- **functools.wraps**: Decorator metadata preservation