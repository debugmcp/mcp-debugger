# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/inspect.py
@source-hash: ccda1da2b37db00f
@generated: 2026-02-09T18:13:01Z

## Python Inspect Module

This is Python's standard `inspect` module providing introspection capabilities for live Python objects. It serves as a comprehensive toolkit for examining objects, source code, and runtime state.

### Core Purpose
- **Object type checking**: Functions like `ismodule()`, `isclass()`, `isfunction()` (L298-532) determine object types
- **Source code extraction**: `getsource()` (L1279), `getsourcelines()` (L1258), `findsource()` (L1070) retrieve source code from live objects
- **Function signature analysis**: `Signature` class (L2995-3336) and `signature()` function (L3339) provide detailed parameter inspection
- **Stack frame inspection**: `getframeinfo()` (L1684), `stack()` (L1775), `trace()` (L1779) examine call stacks

### Key Classes

**Parameter (L2707-2863)**: Represents function parameters with attributes for name, kind, default values, and annotations. Supports parameter kinds: POSITIONAL_ONLY, POSITIONAL_OR_KEYWORD, VAR_POSITIONAL, KEYWORD_ONLY, VAR_KEYWORD.

**Signature (L2995-3336)**: Comprehensive function signature representation with parameter mapping and argument binding capabilities. Key methods include `bind()` (L3268) and `bind_partial()` (L3275) for argument validation.

**BoundArguments (L2865-2993)**: Result of signature binding operations, providing access to bound arguments as `args` and `kwargs` properties.

### Annotation Handling
**get_annotations() (L176-294)**: Safe annotation extraction with eval_str support for stringized annotations. Handles modules, classes, and callables with proper context resolution.

### Source Code Analysis
**BlockFinder (L1185-1237)**: Tokenizer-based class for detecting code block boundaries using indentation and syntax analysis.

**_ClassFinder (L1039-1067)**: AST visitor for locating class definitions by qualified name, used by `findsource()` for precise source location.

### Generator/Coroutine Introspection
- **Generator state**: `getgeneratorstate()` (L1898), `getgeneratorlocals()` (L1916) 
- **Coroutine state**: `getcoroutinestate()` (L1940), `getcoroutinelocals()` (L1958)
- **Async generator state**: `getasyncgenstate()` (L1979), `getasyncgenlocals()` (L1997)

### Static Attribute Access
**getattr_static() (L1841-1888)**: Retrieves attributes without triggering dynamic lookup, useful for inspecting descriptors and avoiding side effects.

### Implementation Details
- Extensive use of `types` module for type checking
- Caches for module-to-file mappings (`modulesbyfile` L985, `_filesbymodname` L986)
- Compiler flag constants extracted from `dis` module (L167-169)
- Complex signature parsing for built-in functions via `__text_signature__` attribute

### Notable Patterns
- Consistent use of sentinel objects (`_sentinel` L1788, `_empty` L2679) for distinguishing missing values
- Extensive error handling with descriptive TypeError/ValueError messages
- Heavy reliance on `functools.partial` and wrapper unwrapping for signature analysis
- Duck typing support for function-like objects (Cython functions, etc.)