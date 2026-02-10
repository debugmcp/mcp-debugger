# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/symtable.py
@source-hash: 3858ba5f1bd23175
@generated: 2026-02-09T18:07:29Z

## Purpose
High-level Python interface to the compiler's internal symbol tables. Provides object-oriented wrappers around the low-level `_symtable` module for analyzing Python code's namespace structure, variable scoping, and symbol usage.

## Core API
- **`symtable(code, filename, compile_type)` (L12-19)**: Main entry point that returns a SymbolTable for source code analysis
- **`_newSymbolTable` (L39)**: Global factory instance for creating appropriate SymbolTable subclasses

## Key Classes

### SymbolTableFactory (L21-38)
Factory with memoization using WeakValueDictionary. Creates appropriate subclass (Function/Class/SymbolTable) based on `_symtable.TYPE_*` constants. Prevents duplicate objects for same table+filename combination.

### SymbolTable (L42-155) 
Base class wrapping raw `_symtable` objects. Provides:
- **Type identification** (L62-82): Maps internal types to human-readable strings ("module", "function", "class", "annotation", etc.)
- **Symbol lookup** (L125-137): Creates Symbol instances on-demand with caching in `_symbols` dict
- **Child navigation** (L150-154): Access to nested namespaces
- **Metadata access**: name, line number, optimization flags

### Function(SymbolTable) (L157-209)
Specialized for function scopes with lazy-loaded tuple properties:
- **`get_parameters()`** (L170-175): Function parameters (DEF_PARAM flag)
- **`get_locals()`** (L177-184): Local variables (LOCAL, CELL scopes)
- **`get_globals()`** (L186-193): Global references (GLOBAL_IMPLICIT/EXPLICIT)
- **`get_nonlocals()`** (L195-200): Nonlocal declarations
- **`get_frees()`** (L202-208): Free variables from outer scopes

### Class(SymbolTable) (L211-252)
Specialized for class scopes. **`get_methods()`** (L215-252) identifies function-like children, handling edge cases:
- Filters out generators with ".0" parameter
- Handles generic type parameters with nested function scopes
- Returns tuple of method names

### Symbol (L255-354)
Represents individual names in symbol tables. Encapsulates flags and scope information:
- **Scope queries**: `is_global()`, `is_local()`, `is_free()`, `is_nonlocal()`
- **Usage patterns**: `is_referenced()`, `is_assigned()`, `is_parameter()`, `is_imported()`
- **Namespace binding**: `is_namespace()`, `get_namespace(s)()`
- **Annotations**: `is_annotated()`

## Dependencies
- **`_symtable`**: Low-level C extension providing raw symbol table data and constants
- **`weakref`**: For factory memoization to avoid memory leaks

## Key Constants (L4-6)
Symbol flags and scope masks from `_symtable`: USE, DEF_*, SCOPE_*, FREE, LOCAL, GLOBAL_*, CELL

## Architecture Notes
- Factory pattern with weak references prevents memory leaks while enabling object reuse
- Lazy evaluation in Function class avoids unnecessary computation
- Complex generator detection logic in Class.get_methods() handles Python's AST nuances
- Symbol scope calculation uses bitwise operations on flags (`(flags >> SCOPE_OFF) & SCOPE_MASK`)

## Usage Pattern
Typically used by code analysis tools, IDEs, and linters to understand variable scoping and symbol usage in Python source code without executing it.