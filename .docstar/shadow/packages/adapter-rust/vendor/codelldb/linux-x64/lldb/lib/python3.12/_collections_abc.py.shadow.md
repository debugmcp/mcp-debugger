# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/_collections_abc.py
@source-hash: 90324ee3e1c4ca53
@generated: 2026-02-09T18:11:36Z

## Collections Abstract Base Classes Module

This module provides Abstract Base Classes (ABCs) for collections according to PEP 3119, implementing the standard protocol interfaces for Python's collection types. The module was renamed from `collections.abc` to `_collections_abc` for faster interpreter startup (L55-58).

### Core Architecture

The module uses `ABCMeta` (L35) as the metaclass foundation and provides a hierarchical system of ABCs with both abstract and concrete methods. Key utility function `_check_methods()` (L104-114) validates method presence in class hierarchies for `__subclasshook__` implementations.

### Type Discovery Infrastructure (L68-99)

The module introspects built-in types to register them with appropriate ABCs:
- Iterator types: `bytes_iterator`, `dict_keyiterator`, `list_iterator`, etc.
- View types: `dict_keys`, `dict_values`, `dict_items`
- Generator types: `generator`, `coroutine`, `async_generator`

### Single-Method Protocol ABCs

**Hashable** (L116-128): Defines `__hash__()` protocol
**Awaitable** (L131-145): Defines `__await__()` protocol with generic alias support
**Sized** (L399-411): Defines `__len__()` protocol
**Container** (L414-428): Defines `__contains__()` protocol with generic alias support
**Buffer** (L442-454): Defines `__buffer__()` protocol for buffer protocol support

### Async Iteration Hierarchy

**AsyncIterable** (L192-206): Base for async iteration with `__aiter__()`
**AsyncIterator** (L209-225): Extends AsyncIterable, adds `__anext__()`
**AsyncGenerator** (L228-276): Full async generator protocol with `asend()`, `athrow()`, `aclose()`

### Sync Iteration Hierarchy

**Iterable** (L279-294): Base iteration protocol with `__iter__()`
**Iterator** (L297-313): Extends Iterable, adds `__next__()` and registers built-in iterator types (L316-329)
**Reversible** (L332-345): Adds `__reversed__()` to Iterable
**Generator** (L348-396): Full generator protocol with `send()`, `throw()`, `close()`

### Coroutine Support

**Coroutine** (L148-186): Extends Awaitable with generator-like protocol (`send()`, `throw()`, `close()`)

### Collection Hierarchy

**Collection** (L431-439): Combines Sized + Iterable + Container as the base collection interface

### Callable Support

**Callable** (L541-555): Defines `__call__()` protocol with sophisticated generic alias support via `_CallableGenericAlias` (L457-509). Helper functions `_is_param_expr()` (L511-521) and `_type_repr()` (L523-538) support advanced type annotations.

### Set Hierarchy

**Set** (L561-696): Immutable set operations with complete comparison operators (`__le__`, `__lt__`, `__gt__`, `__ge__`, `__eq__`), set operations (`__and__`, `__or__`, `__sub__`, `__xor__`), and `_hash()` method (L665-696) implementing frozenset-compatible hashing
**MutableSet** (L702-779): Adds mutation operations (`add()`, `discard()`, `remove()`, `pop()`, `clear()`) and in-place operators (`__ior__`, `__iand__`, `__ixor__`, `__isub__`)

### Mapping Hierarchy

**Mapping** (L787-837): Read-only mapping with `__getitem__()`, provides `get()`, `keys()`, `items()`, `values()` methods returning view objects. Sets `__abc_tpflags__` for CPython optimization (L798)
**MutableMapping** (L919-999): Adds `__setitem__()`, `__delitem__()`, provides `pop()`, `popitem()`, `clear()`, `update()`, `setdefault()`

### Mapping Views

**MappingView** (L841-854): Base view class with size and representation
**KeysView** (L857-870): Set-like view of mapping keys
**ItemsView** (L875-894): Set-like view of mapping items with value equality checking
**ValuesView** (L900-913): Collection-like view of mapping values

### Sequence Hierarchy

**Sequence** (L1006-1067): Read-only sequence with `__getitem__()`, provides iteration, containment, reversal, `index()`, `count()`. Sets `__abc_tpflags__` (L1016)
**MutableSequence** (L1106-1169): Adds `__setitem__()`, `__delitem__()`, `insert()`, provides `append()`, `clear()`, `reverse()`, `extend()`, `pop()`, `remove()`

### Deprecated Features

**ByteString** (L1094-1103): Deprecated sequence type with custom metaclass `_DeprecateByteStringMeta` (L1074-1092) that issues deprecation warnings

### Registration Pattern

The module extensively uses the `.register()` method to register built-in types with their corresponding ABCs, establishing isinstance/issubclass relationships without inheritance.

### Design Constraints

Comments (L9-33) emphasize that ABC APIs are immutable once published - new methods require creating new ABCs as subclasses to maintain isinstance() contract compliance.