# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/functools.py
@source-hash: cacab9a2d8c018de
@generated: 2026-02-09T18:14:27Z

## Purpose
Python's functools module providing tools for higher-order functions and operations on callable objects. This is a Python wrapper around the C `_functools` module, adding utilities written in Python to the functools module.

## Public API
Module exports (L12-15): `update_wrapper`, `wraps`, `WRAPPER_ASSIGNMENTS`, `WRAPPER_UPDATES`, `total_ordering`, `cache`, `cmp_to_key`, `lru_cache`, `reduce`, `partial`, `partialmethod`, `singledispatch`, `singledispatchmethod`, `cached_property`

## Core Components

### Function Wrapping (L35-78)
- **update_wrapper()** (L35-63): Updates wrapper function metadata to match wrapped function. Copies attributes defined in WRAPPER_ASSIGNMENTS and updates dict-like attributes from WRAPPER_UPDATES.
- **wraps()** (L65-77): Decorator factory that applies update_wrapper() using partial application.
- **WRAPPER_ASSIGNMENTS/UPDATES** (L32-34): Constants defining which attributes to copy/update.

### Class Ordering (L89-199)  
- **total_ordering** (L188-199): Class decorator that generates missing comparison methods from a single defined comparison operator.
- **Helper functions** (L89-186): Internal comparison method generators (_gt_from_lt, _le_from_lt, etc.) with conversion mapping in _convert dict (L173-186).

### Legacy Python 2 Support (L206-268)
- **cmp_to_key()** (L206-228): Converts old-style comparison functions to key functions. Creates K class with comparison methods.
- **reduce()** (L237-263): Implements reduce() for cumulative operations on sequences.

### Partial Application (L276-415)
- **partial class** (L276-344): Creates new function with partial argument application. Handles flattening of nested partials and provides pickle support.
- **partialmethod class** (L347-414): Descriptor version of partial for methods. Supports method binding and descriptor protocol.

### Caching (L428-652)
- **lru_cache()** (L477-521): Decorator providing LRU (Least Recently Used) cache with configurable size limit.
- **_lru_cache_wrapper()** (L523-637): Core implementation with three strategies based on maxsize (0=no cache, None=unlimited, >0=LRU).
- **cache()** (L649-651): Simplified unbounded cache using lru_cache with maxsize=None.
- **_HashedSeq class** (L430-444): List subclass that caches hash value to avoid recomputation.
- **_make_key()** (L446-475): Constructs cache keys from function arguments, optimizing for common cases.

### Single Dispatch (L658-954)
- **singledispatch()** (L798-916): Generic function decorator for type-based method dispatch. Uses method resolution order and ABC support.
- **singledispatchmethod class** (L920-954): Descriptor version of singledispatch for methods.
- **MRO utilities** (L658-770): C3 linearization algorithm implementation for computing method resolution order with ABC support.
- **_find_impl()** (L772-796): Finds best implementation from registry based on type hierarchy.

### Cached Properties (L962-1004)
- **cached_property class** (L962-1004): Property descriptor that caches result after first access. Stores cached value in instance __dict__.

## Key Patterns
- Fallback imports from C implementation when available (L225-228, L265-268, L341-344, L639-642)
- Thread-safe caching with RLock for LRU cache
- Descriptor protocol implementation for method-based decorators
- Type-based dispatch using MRO and ABC registration
- Metadata preservation using update_wrapper pattern throughout