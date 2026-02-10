# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/_collections_abc.py
@source-hash: 90324ee3e1c4ca53
@generated: 2026-02-09T18:08:40Z

## Python Collections Abstract Base Classes Module

This module implements Abstract Base Classes (ABCs) for Python collections according to PEP 3119. It serves as the foundation for type checking and polymorphism in Python's collections hierarchy.

### Core Purpose
- Defines abstract interfaces for collection types (iterables, mappings, sequences, etc.)
- Provides concrete mixin methods for common operations
- Enables `isinstance()` checks and structural subtyping via `__subclasshook__`
- Originally `collections.abc`, renamed to `_collections_abc` for faster interpreter startup (L55-59)

### Key Utility Functions
- `_check_methods(C, *methods)` (L104-114): Core validation function that checks if a class implements required methods by inspecting its MRO
- `_is_param_expr(obj)` (L511-521): Validates parameter expressions for Callable type hints
- `_type_repr(obj)` (L523-538): Specialized repr function for type objects

### Fundamental ABCs

**Basic Protocols:**
- `Hashable` (L116-128): Requires `__hash__` method
- `Sized` (L399-411): Requires `__len__` method  
- `Container` (L414-428): Requires `__contains__` method
- `Callable` (L541-556): Requires `__call__` method, uses custom `_CallableGenericAlias` for type hints

**Iteration Protocols:**
- `Iterable` (L279-295): Requires `__iter__`, base for all iterable types
- `Iterator` (L297-314): Extends Iterable, requires `__next__`, provides `__iter__` returning self
- `Reversible` (L332-346): Extends Iterable, requires `__reversed__`
- `Generator` (L348-396): Extends Iterator, adds `send()`, `throw()`, `close()` methods

**Async Protocols:**
- `Awaitable` (L131-146): Requires `__await__`
- `AsyncIterable` (L192-207): Requires `__aiter__`
- `AsyncIterator` (L209-226): Extends AsyncIterable, requires `__anext__`
- `AsyncGenerator` (L228-276): Extends AsyncIterator, adds async `asend()`, `athrow()`, `aclose()`

**Coroutine Protocol:**
- `Coroutine` (L148-187): Extends Awaitable, requires `send()`, `throw()`, provides `close()`

### Collection Hierarchies

**Base Collection:**
- `Collection` (L431-439): Combines Sized + Iterable + Container, foundation for concrete collections

**Set Hierarchy:**
- `Set` (L561-697): Extends Collection, provides all set operations (`__le__`, `__and__`, `__or__`, etc.), includes `_hash()` method for hashable sets
- `MutableSet` (L702-780): Extends Set, adds abstract `add()`/`discard()`, provides `remove()`, `pop()`, `clear()`, in-place operators

**Mapping Hierarchy:**
- `Mapping` (L787-838): Extends Collection, abstract `__getitem__`, provides `get()`, `keys()`, `items()`, `values()`, equality
- `MutableMapping` (L919-1001): Extends Mapping, adds abstract `__setitem__`/`__delitem__`, provides `pop()`, `popitem()`, `clear()`, `update()`, `setdefault()`
- `MappingView` (L841-855): Base for view objects, stores reference to mapping
- `KeysView` (L857-872): View implementing Set interface for dict keys
- `ItemsView` (L875-897): View implementing Set interface for dict items  
- `ValuesView` (L900-916): View implementing Collection interface for dict values

**Sequence Hierarchy:**
- `Sequence` (L1006-1072): Extends Reversible + Collection, abstract `__getitem__`, provides iteration, `index()`, `count()`
- `MutableSequence` (L1106-1172): Extends Sequence, adds abstract `__setitem__`/`__delitem__`/`insert()`, provides `append()`, `extend()`, `pop()`, `remove()`, `reverse()`, `clear()`
- `ByteString` (L1094-1103): Deprecated unified interface for bytes/bytearray, uses `_DeprecateByteStringMeta` (L1074-1093)

**Buffer Protocol:**
- `Buffer` (L442-454): Requires `__buffer__` method for PEP 688 buffer protocol

### Type System Integration
- Most ABCs support `__class_getitem__` for generic type hints via `GenericAlias`
- `Callable` uses custom `_CallableGenericAlias` (L457-509) for special `Callable[[args], result]` syntax
- Type flags: `Mapping.__abc_tpflags__` and `Sequence.__abc_tpflags__` set CPython type flags

### Concrete Type Registration
Extensive registration of built-in types (L316-330, L699, L782, L838, etc.):
- Iterator types: `bytes_iterator`, `dict_keyiterator`, `list_iterator`, etc.
- Container types: `frozenset` → `Set`, `dict` → `MutableMapping`, `list` → `MutableSequence`
- View types: `dict_keys` → `KeysView`, etc.

### Architecture Notes
- Uses `__subclasshook__` pattern for structural typing - classes implementing required methods automatically satisfy ABC contracts
- Provides extensive mixin functionality - subclasses get concrete implementations for most operations
- Maintains backward compatibility while enabling modern type checking
- ABCs are designed to be stable - new methods require new ABC subclasses rather than modification