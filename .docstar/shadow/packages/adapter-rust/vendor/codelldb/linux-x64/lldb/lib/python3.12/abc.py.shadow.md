# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/abc.py
@source-hash: e558702a95cdce3f
@generated: 2026-02-09T18:09:25Z

## Purpose and Responsibility
Core Python Abstract Base Class (ABC) implementation module providing the foundational infrastructure for defining and working with abstract base classes according to PEP 3119. This is a standard library module vendored within the CodeLLDB debugger package.

## Key Components

### Abstract Method Decorators
- **`abstractmethod` (L7-25)**: Primary decorator marking methods as abstract by setting `__isabstractmethod__ = True` attribute
- **`abstractclassmethod` (L28-45)**: Deprecated decorator combining `classmethod` and abstract marking
- **`abstractstaticmethod` (L48-65)**: Deprecated decorator combining `staticmethod` and abstract marking  
- **`abstractproperty` (L68-82)**: Deprecated decorator combining `property` and abstract marking

### Core Metaclass
- **`ABCMeta` (L92-143)**: Metaclass that implements ABC functionality, with conditional definition based on C extension availability
  - `__new__` (L105-108): Initializes ABC infrastructure via `_abc_init`
  - `register` (L110-115): Registers virtual subclasses without inheritance
  - `__instancecheck__`/`__subclasscheck__` (L117-123): Custom isinstance/issubclass behavior
  - Debug helpers: `_dump_registry`, `_abc_registry_clear`, `_abc_caches_clear` (L125-143)

### Utility Functions
- **`update_abstractmethods` (L146-181)**: Recalculates abstract method sets after class modification, essential for dynamic ABC updates
- **`ABC` (L184-188)**: Convenience base class using ABCMeta metaclass with `__slots__ = ()`

## Architecture Patterns

### Conditional Import Strategy (L84-90)
Uses try/except to prefer C implementation (`_abc` module) over pure Python fallback (`_py_abc`), ensuring performance while maintaining compatibility.

### Abstract Method Detection
All abstract decorators use the `__isabstractmethod__ = True` attribute pattern for marking methods, which is checked throughout the inheritance hierarchy.

### Virtual Subclass Registry
ABCMeta maintains internal registries for virtual subclasses that affect isinstance/issubclass checks without modifying MRO.

## Critical Invariants
- Abstract methods must be overridden in concrete subclasses for instantiation
- `__abstractmethods__` attribute contains frozenset of abstract method names
- Virtual subclasses don't appear in MRO but satisfy isinstance checks
- Cache tokens track registry state for invalidation

## Dependencies
- Internal: `_abc` (C extension) or `_py_abc` (Python fallback)
- Standard library integration with isinstance/issubclass builtin functions