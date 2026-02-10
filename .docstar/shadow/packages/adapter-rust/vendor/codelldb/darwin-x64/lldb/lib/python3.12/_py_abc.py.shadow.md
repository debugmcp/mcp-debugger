# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/_py_abc.py
@source-hash: f9c6fe3dd9b51bd7
@generated: 2026-02-09T18:07:30Z

## Purpose
Implementation of Python's Abstract Base Class (ABC) system, providing the core metaclass and cache token mechanism for ABC registration and subclass checking. Part of Python's standard library ABC infrastructure.

## Key Components

### `get_cache_token()` (L4-11)
Utility function that returns the current ABC cache invalidation counter. Used by external code to detect when ABC registrations have changed and caches need refreshing.

### `ABCMeta` (L14-147) 
Primary metaclass for creating Abstract Base Classes. Handles:
- Abstract method collection and inheritance (L35-52)
- Virtual subclass registration system (L54-70)  
- Optimized isinstance/issubclass checking with caching (L92-147)

#### Key Attributes
- `_abc_invalidation_counter` (L33): Global counter incremented on each virtual subclass registration
- `_abc_registry` (L48): WeakSet of explicitly registered virtual subclasses
- `_abc_cache` (L49): WeakSet caching positive subclass check results
- `_abc_negative_cache` (L50): WeakSet caching negative subclass check results
- `_abc_negative_cache_version` (L51): Version tracking for cache invalidation

#### Core Methods
- `__new__` (L35-52): Collects abstract methods from class and bases, initializes ABC-specific attributes
- `register()` (L54-70): Registers virtual subclasses with cycle detection and cache invalidation
- `__instancecheck__` (L92-106): Optimized isinstance() implementation with cache lookup
- `__subclasscheck__` (L108-147): Complex subclass checking algorithm with multiple fallback strategies

#### Debug/Testing Methods
- `_dump_registry()` (L72-81): Prints ABC state for debugging
- `_abc_registry_clear()` (L83-85): Clears virtual subclass registry
- `_abc_caches_clear()` (L87-90): Clears positive/negative caches

## Dependencies
- `_weakrefset.WeakSet`: Used for all internal registries and caches to avoid memory leaks

## Architecture Notes
- Uses sophisticated caching system with positive/negative caches and version tracking
- Cache invalidation triggered globally across all ABCs when any registration occurs
- Subclass checking follows specific precedence: cache → negative cache → subclass hook → MRO check → registry check → recursive subclass check
- WeakSet usage prevents memory leaks from holding references to registered classes