# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/inspect.py
@source-hash: ccda1da2b37db00f
@generated: 2026-02-09T18:09:54Z

## Purpose

Python's standard `inspect` module - provides introspection capabilities for examining live Python objects, source code, and runtime stack information. Serves as the core introspection library for Python, used by debuggers, profilers, documentation tools, and development environments.

## Key Classes

**Parameter (L2707-2863)**: Represents a function parameter with name, kind (positional-only, keyword-only, etc.), default value, and annotation. Used by Signature objects to model function arguments.

**Signature (L2995-3336)**: Models a callable's complete signature including parameters and return annotation. Provides `bind()` and `bind_partial()` methods for argument validation and mapping.

**BoundArguments (L2865-2993)**: Result of binding arguments to a signature, containing the mapping of parameter names to argument values. Provides `args` and `kwargs` properties for conversion back to positional/keyword form.

**BlockFinder (L1185-1237)**: Token-based parser for finding the end of code blocks, used internally by source code extraction functions.

**Traceback/FrameInfo (L1659-1743)**: Named tuples for holding stack frame information with filename, line number, function name, and code context.

## Core Function Categories

**Type Checking (L298-567)**: 
- `ismodule()`, `isclass()`, `isfunction()`, etc. - object type predicates
- `iscoroutinefunction()`, `isgeneratorfunction()`, `isasyncgenfunction()` - async/generator detection
- `isabstract()` - ABC detection with complex inheritance logic

**Source Code Access (L1070-1286)**:
- `findsource()` (L1070) - extracts full source file and starting line for objects
- `getsource()` (L1279) - returns source code as string
- `getsourcelines()` (L1258) - returns source lines with line numbers
- Complex AST parsing for class definitions using `_ClassFinder` (L1039-1067)

**Member Inspection (L569-744)**:
- `getmembers()` (L611) - retrieves all object members with optional predicate filtering
- `getmembers_static()` (L616) - static version avoiding descriptor protocol
- `classify_class_attrs()` (L632) - categorizes class attributes by type (method, property, data)

**Argument Analysis**:
- `getfullargspec()` (L1358) - comprehensive argument spec extraction
- `getcallargs()` (L1544) - maps call arguments to parameter names
- `signature()` (L3339) - modern signature introspection entry point

**Stack/Frame Inspection (L1745-1783)**:
- `currentframe()`, `stack()`, `trace()` - runtime stack access
- `getframeinfo()` (L1684) - detailed frame information with source context

**Annotation Handling**:
- `get_annotations()` (L176) - safe annotation extraction with eval support and context resolution

## Architecture Patterns

**Unwrapping Chain**: Functions like `unwrap()` (L754) and signature creation follow wrapper chains (`__wrapped__` attributes) to find the underlying callable.

**Static vs Dynamic Access**: Dual access patterns - `getmembers()` vs `getmembers_static()`, `getattr()` vs `getattr_static()` (L1841) to avoid triggering descriptors when needed.

**Signature Creation Pipeline**: Complex multi-stage process in `_signature_from_callable()` (L2497) handling functions, methods, classes, built-ins, and partials with different strategies.

**Caching Strategy**: Module-to-file mapping caches (`modulesbyfile`, `_filesbymodname`) for efficient source location.

## Dependencies

Heavy reliance on `ast` module for source parsing, `types` module for type checking, `tokenize` for code block parsing, and `linecache` for source line access. Integrates with `functools`, `collections`, and `sys` for comprehensive introspection.

## Critical Constraints

- Source code access depends on file availability and proper `__file__` attributes
- Signature creation has complex fallback chains for different callable types  
- Frame access requires `sys._getframe()` availability
- Annotation evaluation needs proper namespace context to avoid `NameError`
- C extension introspection limited to `__text_signature__` when available