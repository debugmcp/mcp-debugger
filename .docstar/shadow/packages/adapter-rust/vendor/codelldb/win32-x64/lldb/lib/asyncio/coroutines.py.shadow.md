# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/asyncio/coroutines.py
@source-hash: 2feec17557c230a8
@generated: 2026-02-09T18:12:19Z

## Purpose
Core asyncio coroutine detection and formatting utilities. Provides type checking and debugging capabilities for async/await patterns with performance optimizations and compatibility handling for various coroutine implementations.

## Key Functions

### `_is_debug_mode()` (L10-13)
Determines if asyncio debug mode is enabled by checking `sys.flags.dev_mode` or `PYTHONASYNCIODEBUG` environment variable. Used throughout asyncio for conditional debug behavior.

### `iscoroutinefunction(func)` (L20-23)
Enhanced coroutine function detection that extends `inspect.iscoroutinefunction()` by also checking for the `_is_coroutine` marker attribute. Handles decorated functions that may not be detected by standard inspection.

### `iscoroutine(obj)` (L32-45)
Optimized coroutine object detection with type caching. Uses `_iscoroutine_typecache` set to avoid repeated isinstance checks for known coroutine types. Cache is limited to 100 types to prevent memory bloat.

### `_format_coroutine(coro)` (L48-108)
Complex coroutine string representation formatter for debugging. Handles multiple coroutine implementations (native, generator-based, Cython) with defensive programming for missing attributes.

#### Internal Functions:
- `get_name(coro)` (L51-63): Extracts coroutine name with fallbacks for Cython compatibility
- `is_running(coro)` (L65-72): Checks running state via `cr_running` or `gi_running` attributes

## Key Data Structures

### `_is_coroutine` (L17)
Sentinel object used as a marker for decorated coroutine functions. Enables identification of functions that should be treated as coroutines even if not detected by standard inspection.

### `_COROUTINE_TYPES` (L28)
Tuple containing `types.CoroutineType` and `collections.abc.Coroutine` for efficient isinstance checks.

### `_iscoroutine_typecache` (L29)
Set-based cache storing types of objects that have been confirmed as coroutines, optimizing repeated checks.

## Dependencies
- `collections.abc`: Abstract base classes for coroutine detection
- `inspect`: Standard library introspection utilities
- `os`: Environment variable access for debug mode detection
- `sys`: Python flags and system state access
- `types`: Core Python type objects

## Notable Patterns
- **Performance optimization**: Type caching in `iscoroutine()` to avoid repeated isinstance checks
- **Defensive programming**: Extensive attribute checking with fallbacks in `_format_coroutine()`
- **Multi-implementation support**: Handles native coroutines (`cr_*`) and generator-based (`gi_*`) variants
- **Debug-aware**: Provides detailed coroutine state information for debugging purposes

## Critical Constraints
- Type cache limited to 100 entries to prevent unbounded memory growth
- Assumes coroutine objects have either `cr_*` or `gi_*` attribute patterns
- Relies on `_is_coroutine` marker for decorated function detection