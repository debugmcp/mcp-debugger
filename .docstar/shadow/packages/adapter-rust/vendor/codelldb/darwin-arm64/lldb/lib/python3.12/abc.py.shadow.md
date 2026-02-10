# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/abc.py
@source-hash: e558702a95cdce3f
@generated: 2026-02-09T18:07:00Z

**Primary Purpose:** Core implementation of Python's Abstract Base Classes (ABCs) according to PEP 3119, providing metaclass machinery and decorators for defining abstract interfaces.

**Key Components:**

- **`abstractmethod(funcobj)` (L7-25)**: Primary decorator that marks methods as abstract by setting `__isabstractmethod__ = True`. Essential for preventing instantiation of classes with unimplemented abstract methods.

- **Deprecated Abstract Decorators (L28-82)**:
  - `abstractclassmethod(classmethod)` (L28-45): Legacy decorator, superseded by combining `@classmethod` and `@abstractmethod`
  - `abstractstaticmethod(staticmethod)` (L48-65): Legacy decorator, superseded by combining `@staticmethod` and `@abstractmethod`  
  - `abstractproperty(property)` (L68-82): Legacy decorator, superseded by combining `@property` and `@abstractmethod`

- **`ABCMeta(type)` (L92-143)**: Core metaclass that implements ABC functionality:
  - `__new__()` (L105-108): Initializes ABC infrastructure via `_abc_init()`
  - `register()` (L110-115): Registers virtual subclasses without inheritance
  - `__instancecheck__()` (L117-119): Custom `isinstance()` logic including virtual subclasses
  - `__subclasscheck__()` (L121-123): Custom `issubclass()` logic including virtual subclasses
  - Debug methods: `_dump_registry()`, `_abc_registry_clear()`, `_abc_caches_clear()` (L125-143)

- **`update_abstractmethods(cls)` (L146-181)**: Runtime function to recalculate abstract method sets after dynamic class modifications. Scans parent classes and current class `__dict__` for methods with `__isabstractmethod__ = True`.

- **`ABC` (L184-187)**: Convenience base class that uses `ABCMeta` as metaclass, providing simple inheritance-based ABC creation.

**Import Strategy (L84-90):** Conditional import preferring C implementation (`_abc` module) over Python fallback (`_py_abc`), with module name normalization.

**Critical Invariants:**
- Abstract methods must have `__isabstractmethod__ = True` 
- Classes with unimplemented abstract methods cannot be instantiated
- `__abstractmethods__` attribute contains frozenset of abstract method names
- Virtual subclass registration affects `isinstance`/`issubclass` but not MRO

**Architecture:** Two-tier design with low-level C extension functions handling the heavy lifting and Python wrappers providing the public API. The metaclass intercepts class creation to inject ABC behavior.