# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/contextlib.py
@source-hash: 8b7a477f978a8532
@generated: 2026-02-09T18:09:38Z

## Purpose
Python's contextlib module providing utilities for implementing and using context managers (with statements) and async context managers. Core implementation for PEP 343 context manager protocol.

## Key Abstract Base Classes
- **AbstractContextManager** (L17-36): ABC defining `__enter__()` and `__exit__()` methods for synchronous context managers
- **AbstractAsyncContextManager** (L39-59): ABC defining `__aenter__()` and `__aexit__()` methods for asynchronous context managers

## Decorator Classes  
- **ContextDecorator** (L62-82): Mixin enabling context managers to work as decorators via `_recreate_cm()` pattern
- **AsyncContextDecorator** (L85-98): Async version of ContextDecorator for async context managers

## Generator-Based Context Managers
- **_GeneratorContextManagerBase** (L101-122): Shared base for generator-based context managers, handles function wrapping and recreation
- **_GeneratorContextManager** (L125-196): Implements sync context manager from generator functions, complex exception handling in `__exit__()`
- **_AsyncGeneratorContextManager** (L198-269): Async version with `__aenter__()` and `__aexit__()` using `anext()` and `athrow()`

## Decorator Functions
- **contextmanager()** (L272-302): Decorator converting generator functions to context managers
- **asynccontextmanager()** (L305-335): Decorator converting async generator functions to async context managers

## Utility Context Managers
- **closing** (L338-360): Auto-calls `close()` method on wrapped object
- **aclosing** (L363-386): Async version calling `aclose()` method  
- **suppress** (L429-465): Suppresses specified exception types, handles BaseExceptionGroup splitting (L460-464)
- **nullcontext** (L761-785): No-op context manager for conditional usage
- **chdir** (L788-800): Changes working directory temporarily

## Stream Redirection
- **_RedirectStream** (L389-404): Base class for stream redirection with re-entrant stack
- **redirect_stdout** (L407-420): Redirects sys.stdout 
- **redirect_stderr** (L423-426): Redirects sys.stderr

## Exit Stack Management
- **_BaseExitStack** (L468-550): Base class providing callback registration and management via deque
- **ExitStack** (L553-618): Dynamic management of multiple context managers, complex exception chaining logic in `__exit__()`
- **AsyncExitStack** (L622-758): Async version supporting both sync and async callbacks, dual callback handling

## Key Architectural Patterns
- Generator-based context managers use single yield point pattern
- Exception handling preserves context chains and proper suppression semantics  
- Exit stacks maintain LIFO callback order matching nested context behavior
- Decorator pattern allows context managers to wrap functions
- Re-entrant design in redirect streams using target stacks

## Critical Invariants
- Generator context managers are single-use unless recreated
- Exception identity checks prevent incorrect suppression (L163, L189)
- Callback order in exit stacks must be LIFO
- Async exit stacks handle mixed sync/async callbacks correctly