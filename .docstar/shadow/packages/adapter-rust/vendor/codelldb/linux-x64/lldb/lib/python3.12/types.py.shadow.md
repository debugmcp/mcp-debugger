# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/types.py
@source-hash: 345474ef027a1273
@generated: 2026-02-09T18:10:13Z

**Primary Purpose:** Python's types module provides access to built-in type objects that aren't directly available as builtins, along with utilities for dynamic class creation and coroutine decoration.

**Key Type Definitions (L11-62):**
- `FunctionType` (L12): Type of regular functions (`type(_f)`)
- `LambdaType` (L13): Type of lambda functions (same as FunctionType)
- `CodeType` (L14): Type of function code objects
- `CellType` (L23): Type of closure cells from nonlocal variables
- `GeneratorType` (L27): Type of generator objects
- `CoroutineType` (L31): Type of native coroutine objects
- `AsyncGeneratorType` (L37): Type of async generator objects
- `MethodType` (L41): Type of bound methods
- `BuiltinFunctionType` (L43): Type of built-in functions like `len`
- `TracebackType` (L56): Type of exception tracebacks
- `FrameType` (L57): Type of execution frames

**Dynamic Class Creation (L66-144):**
- `new_class()` (L66-74): PEP 3115 compliant dynamic class creation with metaclass support
- `resolve_bases()` (L76-95): Handles PEP 560 MRO entry resolution via `__mro_entries__`
- `prepare_class()` (L97-127): Prepares class namespace using metaclass `__prepare__` method
- `_calculate_meta()` (L129-144): Determines most derived metaclass from inheritance hierarchy

**Utility Functions:**
- `get_original_bases()` (L147-172): Returns class's original bases before `__mro_entries__` modification
- `coroutine()` (L275-324): Decorator converting generator functions to coroutines

**Key Classes:**
- `DynamicClassAttribute` (L175-235): Descriptor routing class attribute access to `__getattr__`, behaves differently for instance vs class access
- `_GeneratorWrapper` (L238-273): Internal wrapper making generators coroutine-compatible

**Modern Type Definitions (L326-331):**
- `GenericAlias` (L326): Type of parameterized generics like `list[int]`
- `UnionType` (L327): Type of union types using `|` syntax
- `EllipsisType`, `NoneType`, `NotImplementedType` (L329-331): Types of singleton objects

**Architecture Notes:**
- Uses temporary functions/classes to extract type objects, then deletes them (L62)
- Coroutine decorator supports both native and Cython-compiled generators
- Exception handling pattern (L53-57) extracts traceback/frame types safely
- Module exports all non-private names via `__all__` (L333)