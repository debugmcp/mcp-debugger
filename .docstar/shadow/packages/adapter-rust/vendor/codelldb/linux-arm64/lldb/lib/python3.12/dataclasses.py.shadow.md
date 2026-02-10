# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/dataclasses.py
@source-hash: d242aea5fcf6408b
@generated: 2026-02-09T18:08:52Z

## Python Dataclasses Module (Standard Library)

**Primary Purpose**: Complete implementation of Python's dataclass decorator and field specification system for automatic generation of special methods (`__init__`, `__repr__`, `__eq__`, etc.) based on class annotations.

### Key Public API

**Main Decorator**:
- `dataclass()` (L1247-1275): Core decorator that transforms classes into dataclasses with auto-generated methods
- `field()` (L404-425): Creates Field objects with custom parameters (default, init, repr, hash, compare, etc.)

**Helper Functions**:
- `fields()` (L1278-1293): Returns tuple of Field objects for a dataclass
- `asdict()` (L1308-1329): Converts dataclass instance to dictionary recursively
- `astuple()` (L1389-1410): Converts dataclass instance to tuple recursively  
- `make_dataclass()` (L1450-1537): Dynamically creates dataclass from field specifications
- `replace()` (L1540-1588): Creates new instance with specified field changes (useful for frozen classes)
- `is_dataclass()` (L1301-1305): Checks if object is dataclass or dataclass instance

### Core Data Structures

**Field Class** (L295-356):
- Represents individual dataclass fields with metadata (name, type, default, factory, init, repr, hash, compare, kw_only)
- Supports PEP 487 `__set_name__` protocol for descriptor defaults
- Private `_field_type` distinguishes regular fields from ClassVars/InitVars

**Special Types**:
- `InitVar` (L268-283): Fields passed to `__init__` but not stored as instance attributes
- `FrozenInstanceError` (L172): Exception raised when modifying frozen dataclass instances
- Sentinel objects: `MISSING` (L186), `KW_ONLY` (L192), `_HAS_DEFAULT_FACTORY` (L180)

**Internal Parameter Storage**:
- `_DataclassParams` (L359-398): Stores decorator parameters for dataclass behavior control

### Method Generation Logic

**Decision Tables** (L31-169): Comprehensive comments documenting when methods are added based on decorator parameters:
- `__init__`: Added when `init=True` and not already defined
- `__repr__`: Added when `repr=True` and not already defined  
- `__eq__`: Added when `eq=True` and not already defined
- Comparison methods (`__lt__`, etc.): Added when `order=True`
- `__hash__`: Complex logic based on `unsafe_hash`, `eq`, `frozen` parameters
- `__setattr__`/`__delattr__`: Added for frozen classes to prevent mutation

**Code Generation Functions**:
- `_create_fn()` (L449-474): Dynamically creates functions from string templates using exec()
- `_init_fn()` (L568-624): Generates `__init__` method handling defaults, factories, post_init
- `_repr_fn()` (L627-635): Generates `__repr__` method with recursive representation protection
- `_hash_fn()` (L675-680): Generates `__hash__` method from hashable fields
- `_cmp_fn()` (L661-672): Generates comparison methods (`__eq__`, `__lt__`, etc.)

### Processing Pipeline

**`_process_class()`** (L921-1152): Main processing function that:
1. Collects fields from class annotations and inheritance chain
2. Validates field definitions and dataclass constraints
3. Handles frozen class inheritance rules
4. Generates and installs requested methods
5. Optionally adds `__slots__` support via `_add_slots()`
6. Updates abstract methods via `abc.update_abstractmethods()`

**Field Processing**:
- `_get_field()` (L760-855): Creates Field objects from annotations, handles ClassVar/InitVar detection
- Field type detection via regex patterns and module introspection for string annotations
- Mutable default validation (prevents list/dict defaults without factory)

### Advanced Features

**Slots Support** (L1192-1244):
- `_add_slots()` creates new class with `__slots__` for memory efficiency
- Handles slot inheritance and conflicts
- Adds pickling support (`__getstate__`/`__setstate__`) for frozen+slots classes

**Recursive Conversion**:
- `_asdict_inner()` (L1332-1386): Deep conversion handling namedtuples, containers, defaultdicts
- `_astuple_inner()` (L1413-1447): Similar recursive tuple conversion
- `_ATOMIC_TYPES` (L227-246): Optimization for types safe from deep copying

**Type Annotation Support**:
- String annotation parsing via `_MODULE_IDENTIFIER_RE` (L223)
- ClassVar/InitVar detection in both type objects and string annotations
- Module-aware type resolution for proper scoping

### Notable Implementation Details

- Uses `exec()` for dynamic method generation with proper scoping via closure capture
- Recursive representation protection via `_recursive_repr()` (L250-266) 
- Thread-safe recursive detection using thread IDs
- Comprehensive parameter validation and error messages
- Maintains field definition order (relies on dict insertion order preservation)
- Supports generic dataclasses via `types.new_class()` in `make_dataclass()`