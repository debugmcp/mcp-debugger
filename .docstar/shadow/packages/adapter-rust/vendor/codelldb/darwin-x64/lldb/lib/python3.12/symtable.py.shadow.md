# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/symtable.py
@source-hash: 3858ba5f1bd23175
@generated: 2026-02-09T18:08:14Z

## Purpose and Responsibility

Python standard library interface to the compiler's internal symbol tables. Provides high-level access to Python's symbol table analysis capabilities for inspecting variable scoping, symbol definitions, and namespace relationships in Python source code.

## Key Components

### Main Entry Point
- `symtable(code, filename, compile_type)` (L12-19): Primary API function that creates a SymbolTable from source code using the internal _symtable module

### Factory Pattern
- `SymbolTableFactory` (L21-38): Factory class implementing memoization via weak references to avoid duplicate SymbolTable instances
  - `new()` (L25-30): Creates appropriate subclass (Function/Class/SymbolTable) based on table type
  - `__call__()` (L32-37): Memoized factory method using WeakValueDictionary
- `_newSymbolTable` (L39): Global factory instance used throughout module

### Core Classes

#### SymbolTable (L42-155)
Base class representing a symbol table scope with comprehensive introspection capabilities:
- `get_type()` (L62-82): Returns scope type string (module/function/class/annotation/etc.)
- `lookup(name)` (L125-137): Returns Symbol instance for given identifier, creates and caches if needed
- `get_symbols()` (L139-143): Returns all Symbol instances in table
- `get_children()` (L150-154): Returns nested symbol tables
- Private `__check_children()` (L145-148): Helper for finding child tables by name

#### Function(SymbolTable) (L157-209)
Specialized for function scopes with variable categorization:
- `get_parameters()` (L170-175): Returns function parameters using DEF_PARAM flag
- `get_locals()` (L177-184): Returns local variables (LOCAL, CELL scopes)
- `get_globals()` (L186-193): Returns global variables (GLOBAL_IMPLICIT, GLOBAL_EXPLICIT)
- `get_frees()` (L202-208): Returns free variables (closure variables)
- `get_nonlocals()` (L195-200): Returns nonlocal declarations
- Private `__idents_matching()` (L166-168): Helper for filtering identifiers by flag tests

#### Class(SymbolTable) (L211-253)
Specialized for class scopes:
- `get_methods()` (L215-252): Complex method detection logic handling regular functions, generators, and generic type parameters with special cases for generator expressions

#### Symbol (L255-354)
Represents individual symbols with comprehensive flag-based introspection:
- Classification methods: `is_parameter()`, `is_global()`, `is_local()`, `is_free()`, `is_imported()`, `is_assigned()`, etc. (L278-324)
- Namespace methods: `is_namespace()`, `get_namespaces()`, `get_namespace()` (L325-353)
- Uses bit manipulation on `__flags` and `__scope` for efficient categorization

## Dependencies

- `_symtable`: Internal C module providing low-level symbol table access
- `weakref`: For memoization without preventing garbage collection
- Imports various flag constants (USE, DEF_*, SCOPE_*, etc.) for symbol classification

## Architectural Patterns

- **Factory Pattern**: Centralized object creation with type-specific instantiation
- **Memoization**: Weak reference caching to avoid duplicate objects
- **Flag-based Classification**: Extensive use of bit flags for symbol properties
- **Lazy Evaluation**: Properties computed and cached on first access (Function class)
- **Template Method**: Base SymbolTable with specialized subclasses

## Critical Invariants

- Symbol table hierarchy mirrors Python's lexical scoping structure
- Factory ensures unique instances per (table, filename) pair via weak references
- Flag constants must match internal _symtable C module definitions
- Method detection in Class handles edge cases for generators and generic type parameters