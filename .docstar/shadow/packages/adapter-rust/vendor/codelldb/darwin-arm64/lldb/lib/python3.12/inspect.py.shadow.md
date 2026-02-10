# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/inspect.py
@source-hash: ccda1da2b37db00f
@generated: 2026-02-09T18:07:19Z

**Primary Purpose**: Python's standard library `inspect` module providing comprehensive runtime introspection capabilities for analyzing live objects, source code, function signatures, and stack frames.

**Core Type Checking Functions (L298-567)**:
- `ismodule()`, `isclass()`, `ismethod()`, `isfunction()` (L298-389): Basic type identification
- `isgeneratorfunction()`, `iscoroutinefunction()`, `isasyncgenfunction()` (L402-441): Advanced callable type checking using code flags
- `ismethoddescriptor()`, `isdatadescriptor()`, `ismemberdescriptor()` (L310-376): Descriptor type detection
- `isabstract()` (L545-567): ABC detection using `TPFLAGS_IS_ABSTRACT` flag and `__abstractmethods__`

**Annotation Processing (L176-294)**:
- `get_annotations()` (L176-294): Safe annotation extraction with optional string evaluation, handles modules/classes/callables differently, supports type parameter injection

**Member Introspection (L569-744)**:
- `getmembers()`/`getmembers_static()` (L611-628): Extract object members with optional filtering
- `classify_class_attrs()` (L632-744): Detailed class attribute analysis returning `Attribute` namedtuples with kind classification

**Source Code Extraction (L785-1286)**:
- `findsource()` (L1070-1136): Core source retrieval with AST parsing for classes via `_ClassFinder`
- `getsource()`, `getsourcelines()` (L1279-1286, L1258-1277): User-facing source code access
- `BlockFinder` class (L1185-1237): Tokenizer-based code block boundary detection
- `getfile()`, `getsourcefile()` (L911-975): File location resolution with bytecode handling

**Function Signature System (L2015-3342)**:
- `Parameter` class (L2707-2863): Represents function parameters with kind, default, annotation
- `Signature` class (L2995-3336): Complete function signature with parameter binding
- `BoundArguments` class (L2865-2993): Result of argument binding with args/kwargs properties
- `signature()` function (L3339-3342): Main entry point for signature extraction

**Stack Frame Analysis (L1657-1783)**:
- `getframeinfo()` (L1684-1725): Extract frame information with source context
- `getouterframes()`, `getinnerframes()` (L1745-1769): Stack traversal utilities
- `currentframe()`, `stack()`, `trace()` (L1771-1783): Current execution context access

**Generator/Coroutine Introspection (L1891-2012)**:
- State inspection functions: `getgeneratorstate()`, `getcoroutinestate()`, `getasyncgenstate()`
- Local variable access: `getgeneratorlocals()`, `getcoroutinelocals()`, `getasyncgenlocals()`

**Static Attribute Access (L1786-1888)**:
- `getattr_static()` (L1841-1888): Retrieve attributes without triggering descriptors, uses complex MRO traversal with weakref caching

**Key Dependencies**:
- `ast`, `dis`, `types`: Core Python introspection support
- `tokenize`, `linecache`: Source code processing  
- `functools`, `collections`: Utility support
- `weakref`: Memory-efficient caching

**Architecture Patterns**:
- Extensive use of `isinstance()` checks for type detection
- AST parsing for source analysis (`_ClassFinder`)
- Tokenization for code boundary detection (`BlockFinder`) 
- Descriptor protocol awareness throughout
- Comprehensive error handling with specific exception types

**Critical Constants**:
- Compiler flags: `CO_GENERATOR`, `CO_COROUTINE`, `CO_ASYNC_GENERATOR` (L165-170)
- Parameter kinds: `_POSITIONAL_ONLY`, `_POSITIONAL_OR_KEYWORD`, etc. (L2683-2704)
- Object type flags: `TPFLAGS_IS_ABSTRACT` (L173)

**Module Globals**:
- `modulesbyfile`, `_filesbymodname` (L985-986): File-to-module mapping caches
- `_is_coroutine_mark` (L410): Marker object for coroutine decoration