# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/types.py
@source-hash: 345474ef027a1273
@generated: 2026-02-09T18:14:34Z

**Primary Purpose**: Python `types` module providing type objects and utilities for built-in types that aren't directly accessible as builtins. Essential for type introspection, dynamic class creation, and coroutine handling.

## Core Type Definitions (L11-61)

**Function Types**:
- `FunctionType` (L12): Regular function type via `type(_f)`
- `LambdaType` (L13): Lambda type (same as FunctionType)
- `CodeType` (L14): Code object type from function.__code__
- `CellType` (L23): Closure cell type from nonlocal variable factory

**Generator & Async Types**:
- `GeneratorType` (L27): Generator function type
- `CoroutineType` (L31): Native async function type
- `AsyncGeneratorType` (L37): Async generator type

**Method Types**:
- `MethodType` (L41): Bound instance method type
- `BuiltinFunctionType` (L43): Built-in function type (e.g., `len`)
- `BuiltinMethodType` (L44): Built-in method type (same as BuiltinFunctionType)

**Descriptor Types**:
- `WrapperDescriptorType` (L46): Slot wrapper type
- `MethodWrapperType` (L47): Method wrapper type
- `MethodDescriptorType` (L48): Unbound method descriptor
- `ClassMethodDescriptorType` (L49): Class method descriptor
- `GetSetDescriptorType` (L59): Property-like descriptor
- `MemberDescriptorType` (L60): Member descriptor

**Runtime Types**:
- `ModuleType` (L51): Module type
- `TracebackType` (L56): Exception traceback type
- `FrameType` (L57): Execution frame type

## Dynamic Class Creation API (L66-144)

**`new_class(name, bases=(), kwds=None, exec_body=None)` (L66-74)**: PEP 3115 compliant dynamic class creation. Resolves MRO entries, prepares metaclass, executes body, and creates class.

**`resolve_bases(bases)` (L76-95)**: PEP 560 MRO entry resolution. Processes `__mro_entries__` methods to flatten generic base classes.

**`prepare_class(name, bases=(), kwds=None)` (L97-127)**: Metaclass preparation. Returns (metaclass, namespace, kwds) tuple after determining most-derived metaclass and calling `__prepare__`.

**`_calculate_meta(meta, bases)` (L129-144)**: Metaclass conflict resolution. Finds most-derived metaclass or raises TypeError for conflicts.

## Utility Functions

**`get_original_bases(cls, /)` (L147-172)**: Returns class's original bases before `__mro_entries__` modification. Supports typing generics and special forms.

## Advanced Descriptors

**`DynamicClassAttribute` (L175-235)**: Descriptor routing class attribute access to `__getattr__`. Different behavior for instance vs class access. Used by Enum for virtual class attributes.

Key methods:
- `__get__` (L202-209): Routes class access via AttributeError
- `__set__`/`__delete__` (L211-219): Standard descriptor protocol
- `getter`/`setter`/`deleter` (L221-235): Fluent builder pattern

## Coroutine Infrastructure

**`_GeneratorWrapper` (L238-273)**: Wraps generator-like objects to behave as coroutines. Provides both generator (`gi_*`) and coroutine (`cr_*`) interface attributes.

**`coroutine(func)` (L275-324)**: Decorator converting generator functions to coroutines. Handles code object flag manipulation (CO_ITERABLE_COROUTINE) and wraps non-native coroutine objects.

## Modern Type Definitions (L326-331)

- `GenericAlias` (L326): Generic type alias type (e.g., `list[int]`)
- `UnionType` (L327): Union type from `|` operator
- `EllipsisType` (L329): Ellipsis singleton type
- `NoneType` (L330): None singleton type  
- `NotImplementedType` (L331): NotImplemented singleton type

**Architecture**: Uses introspective type creation pattern throughout - creates instances then extracts their types. Clean separation between type definitions, dynamic class utilities, and coroutine support.