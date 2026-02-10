# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/_collections_abc.py
@source-hash: 90324ee3e1c4ca53
@generated: 2026-02-09T18:07:44Z

## Core Purpose
Implementation of Abstract Base Classes (ABCs) for Python collections following PEP 3119. This is the internal `_collections_abc` module (renamed from `collections.abc` for faster interpreter startup) that defines the foundational type system for Python's collection protocols.

## Key Architecture
- **ABC Framework**: Uses `ABCMeta` and `@abstractmethod` to define contracts for collection types
- **Subclass Hook Pattern**: Each ABC implements `__subclasshook__` using `_check_methods()` (L104-114) for duck typing
- **Type Registration**: Built-in types are registered with appropriate ABCs for `isinstance()` compatibility
- **Generic Alias Support**: Many ABCs support generic type annotations via `__class_getitem__`

## Core ABCs

### Basic Protocols
- **Hashable** (L116-129): Requires `__hash__()` method
- **Sized** (L399-412): Requires `__len__()` method  
- **Container** (L414-429): Requires `__contains__()` method
- **Callable** (L541-556): Requires `__call__()` method with custom generic alias handling
- **Collection** (L431-440): Combines Sized, Iterable, Container

### Iteration Protocols
- **Iterable** (L279-295): Requires `__iter__()` method
- **Iterator** (L297-314): Extends Iterable, requires `__next__()` method, registers all built-in iterator types (L316-329)
- **Reversible** (L332-346): Extends Iterable, requires `__reversed__()` method
- **Generator** (L348-397): Extends Iterator, adds `send()`, `throw()`, `close()` methods

### Async Protocols
- **Awaitable** (L131-146): Requires `__await__()` method
- **Coroutine** (L148-189): Extends Awaitable, adds async generator protocol methods
- **AsyncIterable** (L192-207): Requires `__aiter__()` method
- **AsyncIterator** (L209-226): Extends AsyncIterable, requires `__anext__()` method
- **AsyncGenerator** (L228-276): Extends AsyncIterator, adds async `send()`, `throw()`, `close()`

### Set Operations
- **Set** (L561-698): Extends Collection, provides complete set algebra operations (`__le__`, `__lt__`, `__and__`, `__or__`, `__sub__`, `__xor__`, `isdisjoint()`, `_hash()`)
- **MutableSet** (L702-782): Extends Set, adds abstract `add()`, `discard()` methods and concrete `remove()`, `pop()`, `clear()`

### Mapping Operations
- **Mapping** (L787-839): Extends Collection, requires `__getitem__()`, provides `get()`, `keys()`, `items()`, `values()` view methods
- **MutableMapping** (L919-1001): Extends Mapping, adds abstract `__setitem__()`, `__delitem__()`, provides `pop()`, `popitem()`, `clear()`, `update()`, `setdefault()`

### View Types
- **MappingView** (L841-855): Base for mapping views, requires `_mapping` attribute
- **KeysView** (L857-872): Set-like view of mapping keys
- **ItemsView** (L875-897): Set-like view of mapping items  
- **ValuesView** (L900-916): Collection-like view of mapping values

### Sequence Operations
- **Sequence** (L1006-1072): Extends Reversible+Collection, requires `__getitem__()`, provides iteration, containment, `index()`, `count()`
- **MutableSequence** (L1106-1172): Extends Sequence, adds abstract `__setitem__()`, `__delitem__()`, `insert()`, provides `append()`, `extend()`, `pop()`, `remove()`, `reverse()`, `clear()`
- **ByteString** (L1094-1103): Deprecated ABC for bytes/bytearray unification
- **Buffer** (L442-455): Protocol for buffer objects requiring `__buffer__()` method

## Special Features
- **Callable Generic Alias** (L457-539): Custom generic alias `_CallableGenericAlias` handles `Callable[[args], return]` syntax
- **Type Introspection**: Module defines type objects for various built-in iterators (L68-99) 
- **ABC Maintenance**: Extensive comments (L9-33) document ABC evolution constraints
- **Name Aliasing**: `__name__ = "collections.abc"` (L59) for backward compatibility

## Critical Invariants
- ABCs cannot add new methods after publication without breaking isinstance() contracts
- All set operations must be compatible with built-in frozenset hashing algorithm
- Mapping views must stay synchronized with underlying mapping
- Iterator protocol requires both `__iter__()` and `__next__()` methods