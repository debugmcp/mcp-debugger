# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/_py_abc.py
@source-hash: f9c6fe3dd9b51bd7
@generated: 2026-02-09T18:06:58Z

**Primary Purpose:** Core implementation of Python's Abstract Base Class (ABC) system, providing metaclass infrastructure for defining and managing abstract base classes with virtual subclass registration and efficient caching.

**Key Components:**

**get_cache_token() (L4-11):** Returns opaque token identifying current ABC cache version. Token changes whenever any ABC registers a virtual subclass, enabling external cache invalidation detection.

**ABCMeta (L14-147):** Metaclass implementing ABC functionality with sophisticated inheritance checking and caching:

- **_abc_invalidation_counter (L33):** Global counter incremented on virtual subclass registration to invalidate negative caches
- **__new__ (L35-52):** Creates ABC classes, computes abstract method sets from `__isabstractmethod__` attributes across inheritance hierarchy, initializes three WeakSet caches
- **register() (L54-70):** Registers virtual subclasses, performs cycle detection, increments invalidation counter
- **_dump_registry() (L72-81):** Debug helper printing ABC registry state
- **_abc_registry_clear() (L83-85):** Clears virtual subclass registry 
- **_abc_caches_clear() (L87-90):** Clears positive and negative caches

**Instance Management:**
- **__instancecheck__ (L92-106):** Overrides `isinstance()` with cache-aware checking, handles both direct class and metaclass scenarios
- **__subclasscheck__ (L108-147):** Implements `issubclass()` with multi-tier checking: positive cache → negative cache (with invalidation) → subclass hook → MRO → registered classes → direct subclasses

**Architecture Patterns:**

**Three-tier Caching System:**
- `_abc_cache`: WeakSet of confirmed subclasses (positive cache)
- `_abc_negative_cache`: WeakSet of rejected subclasses (negative cache)  
- `_abc_negative_cache_version`: Version tracking for cache invalidation

**Dependencies:**
- `_weakrefset.WeakSet`: Memory-efficient storage preventing reference cycles
- Built-in `type`, `issubclass()`, `isinstance()` for inheritance checking

**Critical Invariants:**
- Abstract methods accumulate across inheritance hierarchy via `__abstractmethods__` frozenset
- Cycle detection prevents infinite recursion in virtual subclass relationships  
- Cache invalidation maintains consistency across all ABCs when any registration occurs
- WeakSet usage prevents memory leaks from cached class references