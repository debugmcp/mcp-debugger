# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/_py_abc.py
@source-hash: f9c6fe3dd9b51bd7
@generated: 2026-02-09T18:12:44Z

## Core Purpose
Low-level implementation of Python's Abstract Base Class (ABC) system, providing metaclass functionality and cache management for virtual subclass registration and isinstance/issubclass operations.

## Key Components

### ABCMeta Metaclass (L14-147)
Primary metaclass implementing ABC functionality:
- **Purpose**: Enables classes to define abstract methods and register virtual subclasses
- **Key attributes**:
  - `_abc_invalidation_counter` (L33): Global counter for cache invalidation
  - `_abc_registry` (L48): WeakSet of registered virtual subclasses  
  - `_abc_cache` (L49): WeakSet caching positive subclass checks
  - `_abc_negative_cache` (L50): WeakSet caching negative subclass checks
  - `__abstractmethods__` (L46): Frozenset of abstract method names

### Core Methods

**__new__ (L35-52)**
- Collects abstract methods from current class and base classes
- Initializes ABC registry and cache systems
- Sets up weak reference containers for memory efficiency

**register (L54-70)**
- Registers unrelated classes as virtual subclasses
- Performs cycle detection to prevent inheritance loops
- Increments global invalidation counter to clear negative caches
- Returns subclass for decorator usage

**__instancecheck__ (L92-106)**
- Optimized isinstance() implementation with caching
- Fast-path cache lookup before falling back to subclass checking
- Handles both direct class and metaclass instance types

**__subclasscheck__ (L108-147)**
- Complex issubclass() implementation with multi-level caching
- Cache invalidation based on global counter
- Checks: subclass hook → direct inheritance → registered classes → recursive subclasses
- Updates positive/negative caches based on results

### Utility Functions

**get_cache_token (L4-11)**
- Returns current cache invalidation counter as opaque token
- Used by external code to detect ABC registry changes

**Debug helpers (L72-90)**
- `_dump_registry`: Prints ABC state for debugging
- `_abc_registry_clear`: Clears virtual subclass registry
- `_abc_caches_clear`: Clears positive/negative caches

## Dependencies
- `_weakrefset.WeakSet`: Memory-efficient weak reference collections
- Built-in `type`, `isinstance`, `issubclass` functions

## Architecture Patterns
- **Weak references**: Prevents circular references in inheritance hierarchies
- **Multi-level caching**: Positive/negative caches with invalidation for performance
- **Hook pattern**: `__subclasshook__` allows custom subclass logic
- **Global state**: Shared invalidation counter across all ABC instances

## Critical Invariants
- Cache version consistency prevents stale negative cache hits
- Cycle detection prevents infinite recursion in inheritance chains
- Abstract method collection must traverse entire MRO
- WeakSet usage prevents memory leaks from cached references