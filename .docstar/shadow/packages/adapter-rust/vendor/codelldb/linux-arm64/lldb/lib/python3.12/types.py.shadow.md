# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/types.py
@source-hash: 345474ef027a1273
@generated: 2026-02-09T18:09:27Z

**Primary Purpose:** Python's built-in `types` module - provides programmatic access to type objects for built-in types that aren't directly accessible as builtins, plus utilities for dynamic class creation and coroutine conversion.

## Type Object Definitions (L11-62)

**Function and Code Types:**
- `FunctionType` (L12): Type of user-defined functions
- `LambdaType` (L13): Identical to FunctionType 
- `CodeType` (L14): Type of code objects (function.__code__)
- `CellType` (L23): Type of closure cell objects from nonlocal variables

**Generator and Async Types:**
- `GeneratorType` (L27): Type of generator objects
- `CoroutineType` (L31): Type of native coroutine objects
- `AsyncGeneratorType` (L37): Type of async generator objects

**Method and Descriptor Types:**
- `MethodType` (L41): Type of bound instance methods
- `BuiltinFunctionType` (L43): Type of built-in functions like len()
- `WrapperDescriptorType` (L46): Type of slot wrapper descriptors
- `MethodWrapperType` (L47): Type of bound slot wrapper methods
- `MethodDescriptorType` (L48): Type of unbound method descriptors
- `ClassMethodDescriptorType` (L49): Type of class method descriptors

**System Types:**
- `ModuleType` (L51): Type of modules
- `TracebackType` (L56): Type of traceback objects
- `FrameType` (L57): Type of frame objects
- `GetSetDescriptorType` (L59): Type of data descriptors
- `MemberDescriptorType` (L60): Type of member descriptors

## Dynamic Class Creation (L66-144)

**Core Functions:**
- `new_class(name, bases=(), kwds=None, exec_body=None)` (L66): Creates class objects dynamically using appropriate metaclass, implements PEP 3115
- `resolve_bases(bases)` (L76): Resolves MRO entries dynamically per PEP 560, handles __mro_entries__ protocol
- `prepare_class(name, bases=(), kwds=None)` (L97): Calls metaclass __prepare__ method, returns (metaclass, namespace, kwds) tuple
- `_calculate_meta(meta, bases)` (L129): Determines most derived metaclass to avoid metaclass conflicts

## Utility Functions (L147-172)

**Base Inspection:**
- `get_original_bases(cls, /)` (L147): Returns class's original bases before __mro_entries__ modification, supports typing generics

## Descriptors (L175-235)

**DynamicClassAttribute Class:**
- Purpose: Routes class attribute access to __getattr__, different behavior for instance vs class access
- Key methods: `__get__` (L202), `__set__` (L211), `__delete__` (L216)
- Decorator methods: `getter` (L221), `setter` (L227), `deleter` (L232)

## Coroutine Support (L238-324)

**_GeneratorWrapper Class (L238-273):**
- Wraps generator-like objects to provide coroutine interface
- Implements generator protocol: `send`, `throw`, `close`, `__next__`, `__iter__`
- Provides both generator (gi_*) and coroutine (cr_*) attribute interfaces

**coroutine() Decorator (L275-324):**
- Converts regular generator functions to coroutines
- Handles native coroutines, generator functions, and generator-like objects
- Uses CO_ITERABLE_COROUTINE flag (0x100) for generator-to-coroutine conversion
- Lazy imports functools and _collections_abc for performance

## Modern Type Objects (L326-331)

**Python 3.9+ Types:**
- `GenericAlias` (L326): Type of parameterized generics like list[int]  
- `UnionType` (L327): Type of union expressions like int | str
- `EllipsisType` (L329): Type of Ellipsis singleton
- `NoneType` (L330): Type of None singleton
- `NotImplementedType` (L331): Type of NotImplemented singleton

## Key Dependencies
- `sys` module for accessing system objects and implementation details
- Runtime imports: `functools`, `_collections_abc` (lazy loaded in coroutine decorator)

## Architectural Notes
- Uses factory functions and introspection to obtain type objects rather than hardcoding
- Cleans up temporary objects (L62) to avoid polluting module namespace
- Implements PEP 560 (Core support for typing module) and PEP 3115 (Metaclasses)
- Performance-conscious design with lazy imports where possible