# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/types.py
@source-hash: 345474ef027a1273
@generated: 2026-02-09T18:07:39Z

## Primary Purpose
Python's `types` module - provides type objects for built-in types that aren't directly accessible as builtins. Enables runtime type checking, dynamic class creation, and coroutine/generator manipulation.

## Key Type Definitions (L11-62)
**Function & Code Types:**
- `FunctionType` (L12): Regular function type via `type(_f)`
- `LambdaType` (L13): Lambda function type (identical to FunctionType)
- `CodeType` (L14): Function code object type
- `CellType` (L23): Closure cell type via factory function

**Generator & Coroutine Types:**
- `GeneratorType` (L27): Standard generator type from `yield` function
- `CoroutineType` (L31): Async coroutine type from `async def`
- `AsyncGeneratorType` (L37): Async generator type from `async def` with `yield`

**Method & Descriptor Types:**
- `MethodType` (L41): Bound method type
- `BuiltinFunctionType/BuiltinMethodType` (L43-44): Built-in function types
- `WrapperDescriptorType/MethodWrapperType/MethodDescriptorType` (L46-48): Descriptor variants
- `GetSetDescriptorType/MemberDescriptorType` (L59-60): Property-like descriptors

**Core Object Types:**
- `ModuleType` (L51): Module type via `sys`
- `TracebackType/FrameType` (L56-57): Exception traceback types
- `MappingProxyType` (L15): Read-only dict proxy
- `SimpleNamespace` (L16): Simple attribute container

## Dynamic Class Creation API (L66-144)
**`new_class(name, bases, kwds, exec_body)` (L66-74):**
- PEP 3115 compliant dynamic class creation
- Resolves bases, prepares metaclass, executes body
- Preserves `__orig_bases__` for generic type information

**`resolve_bases(bases)` (L76-95):**
- PEP 560 MRO entry resolution
- Processes `__mro_entries__` methods on non-type bases
- Returns flattened tuple of resolved base classes

**`prepare_class(name, bases, kwds)` (L97-127):**
- Handles metaclass selection and `__prepare__` invocation
- Returns (metaclass, namespace, kwds) tuple
- Uses `_calculate_meta()` for most-derived metaclass resolution

**`_calculate_meta(meta, bases)` (L129-144):**
- Resolves metaclass conflicts via subclass relationships
- Raises TypeError for incompatible metaclass hierarchies

## Utility Functions
**`get_original_bases(cls)` (L147-172):**
- Retrieves class's original bases before `__mro_entries__` modification
- Essential for generic type introspection
- Returns `__orig_bases__` or falls back to `__bases__`

## DynamicClassAttribute Descriptor (L175-235)
Property-like descriptor that routes class attribute access to `__getattr__`:
- `__get__` (L202-209): Raises AttributeError for class access, normal for instance
- `__set__/__delete__` (L211-219): Standard setter/deleter behavior  
- `getter/setter/deleter` (L221-235): Fluent API for descriptor modification
- Used by Enum for virtual class attributes

## Generator Wrapper & Coroutine Decorator (L238-324)
**`_GeneratorWrapper` (L238-273):**
- Wraps generator-like objects to provide coroutine interface
- Properties: `gi_code`, `gi_frame`, `gi_running`, `gi_yieldfrom`
- Aliases coroutine properties (`cr_*`) to generator properties (`gi_*`)

**`coroutine(func)` decorator (L275-324):**
- Converts regular generator functions to coroutines
- Checks CO_COROUTINE/CO_GENERATOR flags in function bytecode
- For non-native generators, returns `_GeneratorWrapper` instance
- Supports Cython-compiled generator-like objects

## Modern Type Definitions (L326-331)
- `GenericAlias` (L326): Type for `list[int]` style generics
- `UnionType` (L327): Type for `int | str` union syntax
- `EllipsisType/NoneType/NotImplementedType` (L329-331): Singleton types

## Dependencies
- `sys`: For implementation namespace and module type
- `functools/_collections_abc`: Lazy imports in coroutine decorator for performance

## Architectural Patterns
- **Type Introspection**: Uses temporary objects to capture type information
- **Lazy Loading**: Defers heavy imports until needed
- **PEP Compliance**: Implements PEP 3115 (metaclasses) and PEP 560 (MRO entries)
- **Cleanup**: Explicit deletion of temporary variables to avoid export pollution