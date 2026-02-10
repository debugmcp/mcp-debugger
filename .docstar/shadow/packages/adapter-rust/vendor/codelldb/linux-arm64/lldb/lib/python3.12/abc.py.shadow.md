# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/abc.py
@source-hash: e558702a95cdce3f
@generated: 2026-02-09T18:08:28Z

This file implements Python's Abstract Base Class (ABC) system according to PEP 3119, providing decorators and metaclasses for defining abstract methods and classes.

## Core Components

**abstractmethod decorator (L7-25)**: Primary decorator that marks methods as abstract by setting `__isabstractmethod__ = True`. Methods marked with this decorator must be overridden in concrete subclasses.

**Deprecated abstract decorators (L28-82)**:
- `abstractclassmethod` (L28-45): Deprecated decorator for abstract class methods
- `abstractstaticmethod` (L48-65): Deprecated decorator for abstract static methods  
- `abstractproperty` (L68-82): Deprecated decorator for abstract properties

All deprecated decorators recommend using `@abstractmethod` combined with the appropriate built-in decorator instead.

**ABCMeta metaclass (L92-143)**: Core metaclass that enables ABC functionality. Provides:
- `__new__` (L105-108): Initializes ABC infrastructure via `_abc_init`
- `register` (L110-115): Registers virtual subclasses that aren't in MRO
- `__instancecheck__`/`__subclasscheck__` (L117-123): Override isinstance/issubclass behavior
- Debug methods: `_dump_registry`, `_abc_registry_clear`, `_abc_caches_clear` (L125-143)

**update_abstractmethods function (L146-181)**: Recalculates abstract method sets after class creation. Scans base classes and current class for methods with `__isabstractmethod__ = True`, updating `__abstractmethods__` frozenset.

**ABC helper class (L184-187)**: Convenience base class using ABCMeta metaclass, provides standard inheritance-based ABC creation.

## Architecture

The module uses a dual-implementation approach (L84-91): attempts to import C implementation from `_abc` module, falls back to Python implementation from `_py_abc`. The C path defines ABCMeta locally, while fallback imports it.

## Key Invariants

- Abstract methods are identified by `__isabstractmethod__ = True` attribute
- Classes with abstract methods cannot be instantiated unless all abstract methods are overridden
- Virtual subclasses registered via `register()` satisfy isinstance/issubclass checks but don't inherit implementation