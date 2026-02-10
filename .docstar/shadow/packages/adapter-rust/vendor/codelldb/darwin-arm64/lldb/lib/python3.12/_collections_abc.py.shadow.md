# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/_collections_abc.py
@source-hash: 90324ee3e1c4ca53
@generated: 2026-02-09T18:07:11Z

## Purpose
This module provides Abstract Base Classes (ABCs) for Python collections according to PEP 3119. It defines the fundamental interfaces for all collection types, enabling duck typing and `isinstance` checks. The file is renamed from `collections.abc` to `_collections_abc` for faster interpreter startup (L55-58).

## Core Utility Functions
- `_check_methods` (L104-114): Validates presence of required methods in MRO for ABC compliance
- `_is_param_expr` (L511-521): Helper for `Callable` type checking, validates parameter expressions
- `_type_repr` (L523-538): Custom type representation for internal use

## Basic Protocol ABCs

### Single-Method Protocols
- `Hashable` (L116-128): Requires `__hash__` method
- `Awaitable` (L131-145): Requires `__await__` method, supports generic aliasing
- `Sized` (L399-411): Requires `__len__` method
- `Container` (L414-428): Requires `__contains__` method
- `Buffer` (L442-454): Requires `__buffer__` method for buffer protocol

### Iterator Protocols
- `Iterable` (L279-294): Base for iteration, requires `__iter__`
- `Iterator` (L297-313): Extends `Iterable`, adds `__next__` requirement
- `Reversible` (L332-345): Extends `Iterable`, requires `__reversed__`

### Async Protocols
- `AsyncIterable` (L192-206): Async version of `Iterable`, requires `__aiter__`
- `AsyncIterator` (L209-225): Extends `AsyncIterable`, adds `__anext__`

## Generator ABCs
- `Generator` (L348-396): Synchronous generators with `send`, `throw`, `close` methods
- `Coroutine` (L148-186): Coroutines extending `Awaitable` with control methods
- `AsyncGenerator` (L228-276): Async generators with `asend`, `athrow`, `aclose` methods

## Collection Hierarchy

### Core Collections
- `Collection` (L431-439): Combines `Sized`, `Iterable`, `Container` - foundation for all collections
- `Callable` (L541-555): Special ABC for callable objects with custom generic alias handling

### Set Types
- `Set` (L561-697): Immutable set interface with comparison operators and set operations
- `MutableSet` (L702-782): Extends `Set`, adds `add`, `discard` methods and in-place operations

### Mapping Types
- `Mapping` (L787-838): Read-only mapping interface with `keys()`, `values()`, `items()` views
- `MutableMapping` (L919-1001): Extends `Mapping`, adds mutation methods like `__setitem__`, `__delitem__`

### Mapping Views
- `MappingView` (L841-854): Base class for mapping views
- `KeysView` (L857-872): Set-like view of mapping keys
- `ItemsView` (L875-897): Set-like view of key-value pairs
- `ValuesView` (L900-916): Collection-like view of mapping values

### Sequence Types
- `Sequence` (L1006-1072): Read-only sequence with indexing, `count`, `index` methods
- `MutableSequence` (L1106-1172): Extends `Sequence`, adds mutation methods and list-like operations
- `ByteString` (L1094-1103): Deprecated ABC unifying `bytes` and `bytearray` with deprecation warnings

## Special Features

### Generic Type Support
Multiple ABCs support generic aliasing via `__class_getitem__` using `GenericAlias` (L38, L145, L206, etc.)

### Custom Callable Generics
`_CallableGenericAlias` (L457-509) provides special handling for `Callable[[args], return]` syntax

### Type Registrations
Built-in types are explicitly registered with appropriate ABCs throughout the file (e.g., L189, L699, L782, L1001)

## Architectural Notes
- Uses `__subclasshook__` pattern for structural typing based on method presence
- Implements rich comparison operators for Set hierarchy
- Provides concrete implementations of derived methods where possible
- Maintains compatibility with built-in Python types through explicit registrations
- Special `__abc_tpflags__` attributes set type flags for CPython optimization (L798, L1016)