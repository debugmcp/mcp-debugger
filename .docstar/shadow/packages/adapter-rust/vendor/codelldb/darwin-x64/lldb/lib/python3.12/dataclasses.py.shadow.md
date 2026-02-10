# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/dataclasses.py
@source-hash: d242aea5fcf6408b
@generated: 2026-02-09T18:08:30Z

## Python Dataclasses Module

**Primary Purpose**: Complete implementation of Python's dataclasses module that provides the @dataclass decorator and related utilities for automatically generating special methods (__init__, __repr__, __eq__, etc.) based on class field annotations.

### Core Classes & Constants

**Field (L295-356)**: Represents a dataclass field configuration with properties for default values, factories, and behavior flags. Contains slots for name, type, default, default_factory, repr, hash, init, compare, metadata, kw_only, and _field_type. Includes __set_name__ support for descriptor protocol.

**InitVar (L268-283)**: Wrapper class for init-only variables that are passed to __init__ and __post_init__ but not stored as instance attributes. Supports generic syntax via __class_getitem__.

**_DataclassParams (L359-398)**: Container for dataclass decorator parameters (init, repr, eq, order, unsafe_hash, frozen, match_args, kw_only, slots, weakref_slot).

**Sentinel Classes**:
- FrozenInstanceError (L172): Exception for frozen class modification attempts
- MISSING (L184-186): Sentinel for missing default values  
- KW_ONLY (L190-192): Marker for keyword-only fields
- _HAS_DEFAULT_FACTORY (L177-180): Marker for default factory usage

### Key Function Groups

**Field Processing Functions**:
- _get_field (L760-855): Converts class annotations and attributes into Field objects, handles ClassVar/InitVar detection
- _fields_in_init_order (L428-434): Separates fields into positional and keyword-only groups
- _field_init (L489-546): Generates field initialization code for __init__
- _init_param (L549-565): Creates parameter string for __init__ signature

**Method Generation Functions**:
- _init_fn (L568-624): Creates complete __init__ method with parameter validation
- _repr_fn (L627-635): Generates __repr__ method with recursive protection
- _hash_fn (L675-680): Creates __hash__ method from hashable fields
- _cmp_fn (L661-672): Generates comparison methods (__eq__, __lt__, etc.)
- _frozen_get_del_attr (L638-658): Creates __setattr__/__delattr__ for frozen classes

**Dataclass Processing Core**:
- _process_class (L921-1152): Main processing function that analyzes class, generates methods, handles inheritance, and manages field resolution
- dataclass (L1247-1275): Primary decorator that wraps _process_class

### Utility & Helper Functions

**Public API Functions**:
- field (L404-425): Creates Field objects with validation
- fields (L1278-1293): Returns tuple of Field objects for a dataclass
- is_dataclass (L1301-1305): Checks if object is a dataclass
- asdict (L1308-1329): Converts dataclass instance to dictionary recursively
- astuple (L1389-1410): Converts dataclass instance to tuple recursively
- make_dataclass (L1450-1537): Dynamically creates dataclass from field specifications
- replace (L1540-1588): Creates new instance with specified field changes

**Internal Helpers**:
- _recursive_repr (L250-266): Decorator preventing infinite recursion in repr
- _create_fn (L449-474): Dynamically creates functions from code strings
- _add_slots (L1192-1244): Creates new class with __slots__ attribute
- _get_slots (L1169-1189): Extracts slot information from class hierarchy

### Architecture & Patterns

**Hash Decision Matrix**: Complex lookup table _hash_action (L900-916) determines hash method generation based on unsafe_hash, eq, frozen, and explicit hash settings.

**Type Detection**: String annotation parsing via _MODULE_IDENTIFIER_RE (L223) and _is_type (L701-757) for ClassVar/InitVar detection without eval().

**Atomic Types Optimization**: _ATOMIC_TYPES (L227-246) frozenset provides fast-path for immutable types in asdict/astuple operations.

**Slots Integration**: Comprehensive __slots__ support with inheritance handling, weakref slot management, and pickle compatibility via _dataclass_getstate/_dataclass_setstate (L1159-1166).

### Critical Invariants

- Fields with defaults cannot be followed by fields without defaults in __init__
- Frozen classes cannot inherit from non-frozen classes and vice versa  
- Mutable defaults are forbidden (detected via __hash__ == None)
- ClassVar and InitVar fields cannot have default_factory
- Order generation requires eq=True