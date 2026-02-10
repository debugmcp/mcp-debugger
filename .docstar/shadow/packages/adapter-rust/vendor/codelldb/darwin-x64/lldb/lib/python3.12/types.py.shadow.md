# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/types.py
@source-hash: 345474ef027a1273
@generated: 2026-02-09T18:08:24Z

## Primary Purpose
Standard Python module that defines type objects for built-in types that aren't directly accessible as builtins. Provides type inspection utilities and dynamic class creation mechanisms following PEP 3115 and PEP 560 specifications.

## Key Type Definitions (L11-62)
### Function and Code Types
- `FunctionType` (L12): Type of user-defined functions
- `LambdaType` (L13): Same as FunctionType, for lambda expressions  
- `CodeType` (L14): Type of code objects from function.__code__
- `CellType` (L23): Type of closure cell variables via factory function

### Generator and Async Types
- `GeneratorType` (L27): Type of generator objects from generator functions
- `CoroutineType` (L31): Type of native coroutine objects from async def
- `AsyncGeneratorType` (L37): Type of async generator objects

### Method and Descriptor Types
- `MethodType` (L41): Type of bound methods on instances
- `BuiltinFunctionType`/`BuiltinMethodType` (L43-44): Types for C-implemented functions/methods
- `WrapperDescriptorType` (L46): Type of slot wrapper descriptors
- `MethodWrapperType` (L47): Type of method wrappers for built-in methods
- `MethodDescriptorType` (L48): Type of unbound methods
- `ClassMethodDescriptorType` (L49): Type of class method descriptors

### Other Core Types
- `ModuleType` (L51): Type of modules
- `TracebackType`/`FrameType` (L56-57): Exception traceback and frame types
- `GetSetDescriptorType`/`MemberDescriptorType` (L59-60): Property descriptor types

## Dynamic Class Creation (L66-144)
### Core Functions
- `new_class()` (L66): Creates classes dynamically following PEP 3115, handles metaclass resolution and __orig_bases__ preservation
- `resolve_bases()` (L76): Resolves MRO entries per PEP 560, processes __mro_entries__ hooks
- `prepare_class()` (L97): Handles metaclass.__prepare__ method invocation, returns (metaclass, namespace, kwds)
- `_calculate_meta()` (L129): Computes most derived metaclass from inheritance hierarchy

## Utility Functions
- `get_original_bases()` (L147): Retrieves pre-MRO-modification bases using __orig_bases__ attribute
- `coroutine()` (L275): Decorator converting generator functions to coroutines, handles CO_ITERABLE_COROUTINE flags

## Special Classes
### DynamicClassAttribute (L175-235)
Descriptor enabling dual behavior: normal instance access but raises AttributeError on class access to trigger __getattr__. Supports getter/setter/deleter chaining like property.

### _GeneratorWrapper (L238-273)
Internal wrapper for generator-like objects to provide coroutine interface. Maps coroutine attributes (cr_*) to generator equivalents (gi_*).

## Modern Type Definitions (L326-331)
- `GenericAlias` (L326): Type of parameterized generics like list[int]
- `UnionType` (L327): Type of union types using | syntax
- `EllipsisType`/`NoneType`/`NotImplementedType` (L329-331): Types of singleton objects

## Dependencies
- `sys`: Module type reference and implementation details
- `functools`/`_collections_abc`: Lazy imports in coroutine decorator for ABC checks

## Architectural Patterns
- Uses factory functions to capture types of otherwise inaccessible objects
- Follows PEP conventions for metaclass and MRO handling
- Implements descriptor protocol for specialized attribute access
- Provides both low-level type objects and high-level creation utilities