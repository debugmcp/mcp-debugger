# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/functools.py
@source-hash: cacab9a2d8c018de
@generated: 2026-02-09T18:08:25Z

## Purpose
Python standard library module providing utilities for working with functions and callable objects. This is a Python wrapper for the underlying C module `_functools`, extending it with Python-implemented utilities.

## Key Components

### Function Wrapper Utilities (L32-77)
- **`WRAPPER_ASSIGNMENTS`** (L32): Tuple defining attributes copied from wrapped to wrapper functions
- **`WRAPPER_UPDATES`** (L34): Tuple defining attributes updated in wrapper functions  
- **`update_wrapper()`** (L35-63): Updates wrapper function metadata to match wrapped function
- **`wraps()`** (L65-77): Decorator factory that applies `update_wrapper()` using `partial()`

### Class Ordering Decorator (L89-199)
- **`total_ordering()`** (L188-199): Class decorator that auto-generates missing comparison methods
- **Helper functions** (L89-171): Internal comparison method generators (`_gt_from_lt`, `_le_from_lt`, etc.)
- **`_convert`** (L173-186): Mapping table for generating missing comparison operators

### Function Converters (L206-268)
- **`cmp_to_key()`** (L206-223): Converts old-style comparison functions to key functions for sorting
- **`reduce()`** (L237-263): Implements functional reduce operation (fallback for C version)

### Partial Application (L276-414)
- **`partial`** (L276-339): Creates partially applied function objects with preset arguments
- **`partialmethod`** (L347-414): Descriptor version of partial for method binding
- **`_unwrap_partial()`** (L419-422): Helper to unwrap nested partial objects

### Caching Decorators (L428-651)
- **`_HashedSeq`** (L430-444): Optimized sequence with cached hash for cache keys
- **`_make_key()`** (L446-475): Creates cache keys from function arguments
- **`lru_cache()`** (L477-521): Least Recently Used cache decorator with size limits
- **`_lru_cache_wrapper()`** (L523-637): Core LRU cache implementation with thread safety
- **`cache()`** (L649-651): Simplified unbounded cache (memoization)

### Single Dispatch Generic Functions (L658-954)
- **`_c3_merge()`** (L658-683): Implements C3 linearization algorithm for method resolution
- **`_c3_mro()`** (L685-728): Computes method resolution order with abstract base class support
- **`_compose_mro()`** (L730-770): Calculates MRO for dispatch including relevant ABCs
- **`_find_impl()`** (L772-796): Finds best matching implementation from registry
- **`singledispatch()`** (L798-916): Creates single-dispatch generic functions
- **`singledispatchmethod`** (L920-954): Descriptor version for single-dispatch methods

### Cached Property (L962-1002)
- **`cached_property`** (L962-1002): Property descriptor that caches result in instance `__dict__`

## Key Dependencies
- `abc.get_cache_token`: For cache invalidation in single dispatch
- `_thread.RLock`: Thread synchronization for LRU cache
- `weakref.WeakKeyDictionary`: Type-based caching in single dispatch
- `types.GenericAlias`: Generic type support

## Architectural Patterns
- **Fallback pattern**: Pure Python implementations with C module imports at module level
- **Descriptor protocol**: Extensive use for method binding (`partialmethod`, `singledispatchmethod`, `cached_property`)
- **Registry pattern**: Type-based dispatch in `singledispatch`
- **Thread safety**: Explicit locking in LRU cache implementation
- **Caching strategies**: Multiple approaches from unbounded to LRU with size limits

## Critical Constraints
- LRU cache requires hashable arguments
- Single dispatch uses first argument type only
- Cached property requires instance `__dict__` support
- Thread safety considerations for concurrent access to caches