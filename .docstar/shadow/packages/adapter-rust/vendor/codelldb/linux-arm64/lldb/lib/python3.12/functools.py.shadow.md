# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/functools.py
@source-hash: cacab9a2d8c018de
@generated: 2026-02-09T18:09:24Z

## Purpose
Python's `functools` module - provides utilities for working with higher-order functions and operations on callable objects. This is the pure Python implementation that wraps the C `_functools` module, adding additional Python-based utilities.

## Key Components

### Function Wrapping Utilities (L25-78)
- `update_wrapper(wrapper, wrapped, assigned=WRAPPER_ASSIGNMENTS, updated=WRAPPER_UPDATES)` (L35-63): Core function that copies metadata from wrapped function to wrapper function
- `wraps(wrapped, assigned=WRAPPER_ASSIGNMENTS, updated=WRAPPER_UPDATES)` (L65-77): Decorator factory using partial application of update_wrapper
- Constants: `WRAPPER_ASSIGNMENTS` (L32-33) and `WRAPPER_UPDATES` (L34) define which attributes to copy

### Total Ordering Decorator (L80-199)
- `total_ordering(cls)` (L188-199): Class decorator that auto-generates missing comparison methods from one user-defined ordering method
- Helper functions (L89-172): Individual comparison method generators (`_gt_from_lt`, `_le_from_lt`, etc.)
- `_convert` dictionary (L173-186): Maps existing comparison methods to functions that generate missing ones

### Comparison Function Converter (L202-228)
- `cmp_to_key(mycmp)` (L206-223): Converts old-style cmp functions to key functions for sorting
- Creates wrapper class `K` with all comparison methods implemented via the cmp function

### Reduce Function (L231-268)
- `reduce(function, sequence, initial=_initial_missing)` (L237-263): Left-fold operation on sequences
- Pure Python implementation with C fallback import

### Partial Application (L271-415)
- `partial` class (L276-340): Creates new function with partial argument application, optimizes nested partials
- `partialmethod` class (L347-414): Descriptor version for methods, handles method binding correctly
- `_unwrap_partial(func)` (L419-422): Helper to extract original function from nested partials

### LRU Cache Implementation (L424-643)
- `lru_cache(maxsize=128, typed=False)` (L477-521): Decorator for least-recently-used caching
- `_lru_cache_wrapper(user_function, maxsize, typed, _CacheInfo)` (L523-637): Core implementation with three strategies based on maxsize
- `_make_key(args, kwds, typed, ...)` (L446-475): Efficient cache key generation
- `_HashedSeq` class (L430-444): Hash-optimized sequence for cache keys
- `cache(user_function)` (L649-651): Simplified unbounded cache

### Single Dispatch Generic Functions (L654-954)
- `singledispatch(func)` (L798-916): Creates generic function with type-based dispatch
- `singledispatchmethod` class (L920-953): Descriptor version for methods
- Complex MRO resolution functions (L658-796): `_c3_merge`, `_c3_mro`, `_compose_mro`, `_find_impl` for finding best implementation match
- Support for Union types and type annotations

### Cached Property (L956-1004)
- `cached_property` class (L962-1002): Property descriptor that caches computed value in instance __dict__
- Handles __set_name__ protocol and error cases for objects without __dict__

## Dependencies
- `abc.get_cache_token`: For singledispatch cache invalidation
- `collections.namedtuple`: For CacheInfo
- `reprlib.recursive_repr`: For safe partial repr
- `_thread.RLock`: For thread-safe LRU cache
- `types.GenericAlias`: For generic type support

## Architectural Patterns
- Extensive use of try/except ImportError blocks to prefer C implementations while providing Python fallbacks
- Closure-based implementations (especially in lru_cache) for encapsulation and performance
- Descriptor protocol usage for method-like decorators
- Complex MRO manipulation for generic function dispatch