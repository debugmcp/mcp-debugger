# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/functools.py
@source-hash: cacab9a2d8c018de
@generated: 2026-02-09T18:07:20Z

## Core Purpose
Python's `functools` module providing utilities for working with functions and callable objects. This is a wrapper around the C `_functools` module that adds Python-implemented utilities for function decoration, partial application, caching, and generic dispatch.

## Key Components

### Function Wrapper Utilities (L25-78)
- `WRAPPER_ASSIGNMENTS` (L32): Tuple of attributes copied from wrapped to wrapper function
- `WRAPPER_UPDATES` (L34): Tuple of attributes merged from wrapped to wrapper
- `update_wrapper(wrapper, wrapped, assigned, updated)` (L35-63): Core utility that copies metadata from wrapped function to wrapper, sets `__wrapped__` attribute
- `wraps(wrapped, assigned, updated)` (L65-77): Decorator factory that applies `update_wrapper` via `partial`

### Total Ordering Class Decorator (L81-199)
- Multiple comparison helper functions (L89-171): `_gt_from_lt`, `_le_from_lt`, etc. - implement missing comparison operators from existing ones
- `_convert` dictionary (L173-186): Maps each comparison operator to functions that derive other operators
- `total_ordering(cls)` (L188-199): Class decorator that auto-generates missing comparison methods from any single defined comparison

### Comparison Function Converter (L202-229)
- `cmp_to_key(mycmp)` (L206-223): Converts old-style cmp functions to key functions for sorting. Returns wrapper class K that implements all comparison operators
- Fallback implementation with C version import attempt (L225-228)

### Reduce Function (L231-268)
- `_initial_missing` (L235): Sentinel for missing initial value
- `reduce(function, sequence, initial)` (L237-263): Left-fold reduction of sequence using binary function
- Fallback implementation with C version import attempt (L265-268)

### Partial Application (L271-415)
- `partial` class (L276-340): Immutable callable that wraps function with pre-applied arguments and keywords. Supports pickling via `__reduce__`/`__setstate__`
- `partialmethod` class (L347-414): Descriptor version of partial for method binding. Handles descriptor protocol and flattens nested partialmethods
- `_unwrap_partial(func)` (L419-422): Utility to unwrap nested partial objects

### LRU Cache Implementation (L424-652)
- `_CacheInfo` namedtuple (L428): Statistics container for cache hits/misses/size
- `_HashedSeq` class (L430-444): List subclass that caches hash value for cache keys
- `_make_key(args, kwds, typed)` (L446-475): Constructs cache keys with type awareness and optimization for single fast-type args
- `lru_cache(maxsize, typed)` (L477-521): Main decorator with three implementations based on maxsize (no cache, unbounded, bounded LRU)
- `_lru_cache_wrapper(user_function, maxsize, typed, _CacheInfo)` (L523-637): Core implementation using circular doubly-linked list for LRU tracking, thread-safe with RLock
- `cache(user_function)` (L649-651): Simplified unbounded cache decorator

### Single Dispatch Generic Functions (L654-954)
- `_c3_merge(sequences)` (L658-683): Merges MRO sequences using C3 linearization algorithm
- `_c3_mro(cls, abcs)` (L685-728): Computes method resolution order with abstract base class insertion
- `_compose_mro(cls, types)` (L730-770): Calculates MRO including relevant ABCs from type iterable
- `_find_impl(cls, registry)` (L772-796): Finds best matching implementation from registry using MRO
- `singledispatch(func)` (L798-916): Function decorator that creates generic function with type-based dispatch. Uses WeakKeyDictionary cache and supports Union types
- `singledispatchmethod` class (L920-954): Descriptor version for methods, wraps singledispatch function

### Cached Property (L956-1004)
- `_NOT_FOUND` sentinel (L960): Marker for missing cached values
- `cached_property` class (L962-1004): Descriptor that caches property result in instance `__dict__`, supports `__set_name__` protocol

## Architecture Notes
- Follows pattern of Python wrapper over C implementation with fallbacks
- Heavy use of descriptor protocol for method-like functionality
- Thread safety via RLock for cache operations
- MRO and C3 linearization for sophisticated type dispatch
- Extensive use of closures and nonlocal for stateful decorators