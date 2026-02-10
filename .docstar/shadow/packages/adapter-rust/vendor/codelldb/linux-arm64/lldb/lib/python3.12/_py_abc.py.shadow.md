# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/_py_abc.py
@source-hash: f9c6fe3dd9b51bd7
@generated: 2026-02-09T18:08:29Z

## Primary Purpose
Core implementation of Python's Abstract Base Class (ABC) metaclass system. Provides the foundational machinery for creating abstract base classes that support virtual subclass registration and optimized isinstance/issubclass checking through caching mechanisms.

## Key Components

### Functions
- `get_cache_token()` (L4-11): Returns the global ABC invalidation counter for cache versioning. Used externally to detect when ABC registrations have changed.

### Classes
- `ABCMeta` (L14-147): Metaclass implementing the complete ABC system with registration, caching, and subclass checking logic.

### ABCMeta Core Attributes (L33-52)
- `_abc_invalidation_counter` (L33): Global counter incremented on each virtual subclass registration
- `_abc_registry` (L48): WeakSet of explicitly registered virtual subclasses  
- `_abc_cache` (L49): WeakSet caching positive subclass check results
- `_abc_negative_cache` (L50): WeakSet caching negative subclass check results
- `_abc_negative_cache_version` (L51): Version number for cache invalidation

### Key Methods
- `__new__()` (L35-52): Class creation logic that computes abstract methods from `__isabstractmethod__` attributes and initializes ABC infrastructure
- `register()` (L54-70): Registers virtual subclasses with cycle detection, increments invalidation counter
- `__instancecheck__()` (L92-106): Optimized isinstance() implementation with cache checking before fallback to subclass logic
- `__subclasscheck__()` (L108-147): Core issubclass() implementation featuring:
  - Cache validation and invalidation (L116-119)
  - Subclass hook delegation (L123-130) 
  - MRO checking (L132-134)
  - Recursive registry checking (L136-139)
  - Recursive subclass checking (L141-144)

### Debug/Testing Utilities
- `_dump_registry()` (L72-81): Diagnostic method for registry inspection
- `_abc_registry_clear()` (L83-85): Registry cleanup for testing
- `_abc_caches_clear()` (L87-90): Cache cleanup for testing

## Architecture Patterns
- **Caching Strategy**: Dual positive/negative caching with version-based invalidation to optimize repeated isinstance/issubclass calls
- **WeakSet Usage**: Prevents memory leaks from circular references in inheritance hierarchies
- **Global Counter**: Simple versioning mechanism to coordinate cache invalidation across all ABC instances
- **Hook Pattern**: `__subclasshook__()` integration allows custom subclass determination logic

## Dependencies
- `_weakrefset.WeakSet`: Memory-safe set implementation for storing class references

## Critical Invariants
- Abstract methods (`__abstractmethods__`) computed as intersection of base class abstracts and current class abstracts with `__isabstractmethod__` flag
- Invalidation counter must increment on every `register()` call to maintain cache consistency
- Cache version tracking prevents stale negative cache hits after new registrations
- Cycle detection in `register()` prevents infinite recursion in subclass checking