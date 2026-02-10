# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/contextlib.py
@source-hash: 8b7a477f978a8532
@generated: 2026-02-09T18:14:24Z

## Primary Purpose
Standard library implementation of context manager utilities and decorators per PEP 343. Provides abstract base classes, decorators for generator-based context managers, and various utility context managers for common patterns.

## Key Classes & Functions

### Abstract Base Classes
- `AbstractContextManager` (L17-36): ABC defining `__enter__`/`__exit__` protocol with subclass hook
- `AbstractAsyncContextManager` (L39-59): ABC for async context managers with `__aenter__`/`__aexit__`

### Decorator Mixins  
- `ContextDecorator` (L62-82): Mixin allowing context managers to work as function decorators via `_recreate_cm()` 
- `AsyncContextDecorator` (L85-98): Async version for coroutine function decoration

### Generator Context Manager Infrastructure
- `_GeneratorContextManagerBase` (L101-122): Shared base for generator-based CMs, handles recreation and docstring preservation
- `_GeneratorContextManager` (L125-196): Sync implementation handling `StopIteration` and exception propagation via `gen.throw()`
- `_AsyncGeneratorContextManager` (L198-269): Async version using `anext()`/`athrow()`/`aclose()`

### Core Decorators
- `contextmanager()` (L272-302): Decorator converting generators to sync context managers
- `asynccontextmanager()` (L305-335): Decorator for async generator context managers

### Utility Context Managers
- `closing` (L338-360): Auto-calls `.close()` on wrapped object
- `aclosing` (L363-386): Async version calling `.aclose()`
- `redirect_stdout`/`redirect_stderr` (L407-426): Temporarily redirect sys streams
- `suppress` (L429-465): Suppress specified exception types, handles BaseExceptionGroup
- `nullcontext` (L761-785): No-op context manager for conditional usage
- `chdir` (L788-800): Temporarily change working directory

### Stack-Based Context Management
- `_BaseExitStack` (L468-549): Base class providing callback registration and management
- `ExitStack` (L553-618): Dynamic context manager stack with complex exception chaining in `__exit__`
- `AsyncExitStack` (L622-758): Async version supporting both sync and async callbacks

## Key Dependencies
- Standard library: `abc`, `sys`, `os`, `_collections_abc`, `deque`, `functools.wraps`
- Uses `MethodType` for bound method creation in exit stacks

## Critical Patterns
- Exception propagation handling in generator CMs prevents `StopIteration` leakage (PEP 479)
- Exit stacks maintain LIFO callback order and complex exception context chaining
- Decorator pattern allows CMs to work as function decorators via recreation
- Stream redirection uses re-entrant design with target stack

## Important Invariants
- Generator CMs are one-shot - require recreation for reuse
- Exit callbacks executed in LIFO order to match nested context behavior  
- Exception identity checks prevent improper suppression
- Async exit stacks handle mixed sync/async callbacks correctly