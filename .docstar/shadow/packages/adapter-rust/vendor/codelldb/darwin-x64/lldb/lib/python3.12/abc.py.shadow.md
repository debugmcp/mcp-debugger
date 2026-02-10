# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/abc.py
@source-hash: e558702a95cdce3f
@generated: 2026-02-09T18:07:32Z

## Python ABC (Abstract Base Class) Module

This is the standard Python `abc` module that implements Abstract Base Classes according to PEP 3119. It provides decorators and metaclasses for defining abstract methods and classes that cannot be instantiated until all abstract methods are implemented.

### Core Components

**abstractmethod decorator (L7-25)**: The primary decorator for marking methods as abstract. Sets `__isabstractmethod__ = True` on the decorated function. Abstract methods must be overridden in concrete subclasses.

**ABCMeta metaclass (L92-143)**: The core metaclass that enables abstract base class functionality. Key methods:
- `__new__` (L105-108): Initializes ABC infrastructure via `_abc_init`
- `register` (L110-115): Registers virtual subclasses that aren't in the inheritance hierarchy
- `__instancecheck__` (L117-119): Custom isinstance() behavior via `_abc_instancecheck`
- `__subclasscheck__` (L121-123): Custom issubclass() behavior via `_abc_subclasscheck`
- Debug methods (L125-143): Registry inspection and cache clearing utilities

**ABC base class (L184-188)**: Convenience class that uses ABCMeta as its metaclass, providing a simple inheritance-based way to create ABCs.

**update_abstractmethods function (L146-181)**: Recalculates the `__abstractmethods__` set for a class by scanning parent classes and the class dict for methods marked with `__isabstractmethod__`.

### Deprecated Decorators

**abstractclassmethod (L28-45)**, **abstractstaticmethod (L48-65)**, **abstractproperty (L68-82)**: Legacy decorators that combine abstract marking with classmethod/staticmethod/property. All deprecated in favor of stacking `@abstractmethod` with the appropriate decorator.

### Implementation Strategy

The module uses conditional imports (L84-90) to leverage either the C implementation (`_abc`) or pure Python fallback (`_py_abc`). When C implementation is available, `ABCMeta` is defined locally; otherwise, it imports from `_py_abc`.

### Key Patterns

- Uses `__isabstractmethod__` attribute to mark abstract methods
- Maintains `__abstractmethods__` frozenset on classes to track unimplemented abstracts
- Virtual subclass registration allows isinstance/issubclass checks without inheritance
- Cache mechanisms optimize repeated type checks