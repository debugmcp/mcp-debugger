# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/abc.py
@source-hash: e558702a95cdce3f
@generated: 2026-02-09T18:12:48Z

## Primary Purpose

Python's Abstract Base Class (ABC) module implementation, providing the foundation for defining abstract interfaces and enforcing method implementation contracts. This is a core Python standard library component that enables formal interface specification through metaclass machinery.

## Key Components

### Abstract Method Decorators

- **`abstractmethod` (L7-25)**: Primary decorator marking methods as abstract. Sets `__isabstractmethod__ = True` attribute on decorated functions. Essential for ABC contract enforcement.

- **`abstractclassmethod` (L28-46)**: Deprecated decorator combining `@classmethod` and `@abstractmethod`. Inherits from `classmethod` and marks both the wrapper and wrapped callable as abstract.

- **`abstractstaticmethod` (L48-66)**: Deprecated decorator combining `@staticmethod` and `@abstractmethod`. Inherits from `staticmethod` with abstract marking.

- **`abstractproperty` (L68-82)**: Deprecated decorator for abstract properties. Inherits from `property` with `__isabstractmethod__ = True`.

### Core ABC Machinery

- **`ABCMeta` (L92-144)**: Metaclass implementing ABC functionality. Key methods:
  - `__new__` (L105-108): Calls `_abc_init()` during class creation
  - `register` (L110-115): Registers virtual subclasses via `_abc_register()`
  - `__instancecheck__` (L117-119): Overrides `isinstance()` behavior
  - `__subclasscheck__` (L121-123): Overrides `issubclass()` behavior
  - Debug helpers: `_dump_registry`, `_abc_registry_clear`, `_abc_caches_clear` (L125-143)

- **`update_abstractmethods` (L146-181)**: Recalculates abstract method sets after class modification. Scans inheritance hierarchy and class dictionary for methods marked with `__isabstractmethod__ = True`.

- **`ABC` (L184-188)**: Convenience base class using `ABCMeta` as metaclass. Provides standard inheritance-based ABC creation.

## Import Strategy & Fallback

Lines 84-91 implement a fallback mechanism:
- Attempts to import optimized C implementations from `_abc` module
- Falls back to pure Python `_py_abc` implementation if C module unavailable
- Sets correct module attribution for `ABCMeta`

## Architectural Patterns

- **Decorator Pattern**: Abstract method decorators modify function objects with metadata
- **Metaclass Protocol**: `ABCMeta` intercepts class creation to inject ABC behavior  
- **Registry Pattern**: Virtual subclass registration system for structural typing
- **Template Method**: `update_abstractmethods` implements algorithm for abstract method discovery

## Critical Invariants

- Abstract classes cannot be instantiated if any abstract methods remain unimplemented
- `__isabstractmethod__ = True` attribute marks abstract methods/properties
- `__abstractmethods__` frozenset contains names of all abstract methods
- Virtual subclass relationships don't affect MRO but influence isinstance/issubclass checks

## Dependencies

- `_abc` (preferred C implementation) or `_py_abc` (Python fallback)
- Core Python metaclass and descriptor protocols