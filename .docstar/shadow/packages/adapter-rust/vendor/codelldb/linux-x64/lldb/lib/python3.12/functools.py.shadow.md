# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/functools.py
@source-hash: cacab9a2d8c018de
@generated: 2026-02-09T18:09:49Z

This is Python's core `functools` module, providing function utilities and decorators for working with higher-order functions and operations on callable objects. It serves as a Python wrapper around the C `_functools` module with additional Python-based utilities.

## Core Components

**Function Wrapper Utilities (L25-78)**
- `update_wrapper()` (L35-63): Copies metadata from wrapped function to wrapper (module, name, qualname, doc, annotations, type_params)
- `wraps()` (L65-77): Decorator factory that applies `update_wrapper()` using `partial()`
- Constants: `WRAPPER_ASSIGNMENTS`, `WRAPPER_UPDATES` define default attributes to copy

**Total Ordering Class Decorator (L80-199)**
- `total_ordering()` (L188-199): Class decorator that auto-generates missing comparison methods from one user-defined comparison
- Helper functions (L89-172): `_gt_from_lt`, `_le_from_lt`, etc. - generate comparison operations from existing ones
- `_convert` dict (L173-186): Maps base operations to lists of derived operations and their generators

**Function Conversion Utilities (L202-268)**
- `cmp_to_key()` (L206-223): Converts old-style comparison functions to key functions for sorting
- `reduce()` (L237-263): Left-fold reduction of sequences with optional initial value
- Both have C fallbacks via `from _functools import` (L225-228, L265-268)

**Partial Application Classes (L271-415)**
- `partial` class (L276-340): Freezes some arguments of a function, creating new callable
  - `__new__()` handles function chaining and validation
  - `__call__()` merges stored and new arguments
  - Pickle support via `__reduce__`/`__setstate__`
- `partialmethod` class (L347-414): Descriptor version for methods, handles `self`/`cls` binding
  - `_make_unbound_method()` (L383-389): Creates method wrapper
  - `__get__()` (L391-408): Descriptor protocol implementation

**LRU Cache Implementation (L424-651)**
- `lru_cache()` decorator (L477-521): Configurable least-recently-used cache with size limits
- `_lru_cache_wrapper()` (L523-637): Core implementation with three strategies:
  - No cache (maxsize=0): Statistics only
  - Unbounded cache (maxsize=None): Simple dict lookup
  - Bounded cache: Circular doubly-linked list for LRU tracking
- `_make_key()` (L446-475): Converts args/kwargs to hashable cache keys
- `_HashedSeq` class (L430-444): Optimized sequence wrapper that caches hash value
- `cache()` function (L649-651): Simplified unbounded cache decorator

**Single Dispatch Generic Functions (L654-954)**
- `singledispatch()` decorator (L798-916): Creates type-based function overloading
  - Uses MRO and ABC registry for dispatch resolution
  - Weak reference cache for performance
  - Support for Union types
- `singledispatchmethod` class (L920-954): Descriptor version for methods
- MRO utilities:
  - `_c3_merge()` (L658-683): C3 linearization algorithm
  - `_c3_mro()` (L685-728): Extended C3 with ABC insertion
  - `_compose_mro()` (L730-770): Builds MRO from class and relevant ABCs
  - `_find_impl()` (L772-796): Finds best implementation for given type

**Cached Property Descriptor (L956-1002)**
- `cached_property` class (L962-1002): Property decorator that caches result in instance `__dict__`
- `__set_name__()` protocol for attribute name tracking
- Comprehensive error handling for classes without `__dict__`

## Key Dependencies
- `abc.get_cache_token` for ABC cache invalidation
- `_thread.RLock` for thread-safe LRU cache
- `reprlib.recursive_repr` for safe string representations
- `types.GenericAlias` for generic type support

## Architecture Notes
- Graceful fallback to C implementations where available
- Thread-safety considerations in LRU cache via RLock
- Memory efficiency through `__slots__` usage and weak references
- Supports both function and method descriptors consistently