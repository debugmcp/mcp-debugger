# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/symtable.py
@source-hash: 3858ba5f1bd23175
@generated: 2026-02-09T18:13:17Z

This module provides a high-level interface to Python's internal symbol table analysis, enabling inspection of variable scopes, bindings, and namespace hierarchies in Python source code.

## Core Purpose
Wraps the low-level `_symtable` module to provide object-oriented access to Python's compile-time symbol analysis. Essential for static analysis tools, debuggers, and code introspection utilities.

## Key Components

### Entry Point Function
- `symtable(code, filename, compile_type)` (L12-19): Main API function that parses source code and returns a SymbolTable instance for the top-level scope

### Factory Pattern
- `SymbolTableFactory` (L21-38): Singleton factory with weak reference memoization that creates appropriate SymbolTable subclasses based on scope type
- `_newSymbolTable` (L39): Global factory instance used throughout the module

### Core Classes

#### SymbolTable (L42-155)
Base class representing a symbol table for any Python scope (module, function, class, etc.)

Key methods:
- `get_type()` (L62-82): Returns scope type ("module", "function", "class", "annotation", etc.)
- `lookup(name)` (L125-137): Returns Symbol instance for given identifier, with lazy Symbol creation and caching
- `get_symbols()` (L139-143): Returns list of all Symbol instances in scope
- `get_children()` (L150-154): Returns nested symbol tables

#### Function(SymbolTable) (L157-208)
Specialized symbol table for function scopes with variable classification:
- `get_parameters()` (L170-175): Function parameters
- `get_locals()` (L177-184): Local variables  
- `get_globals()` (L186-193): Global variables
- `get_frees()` (L202-208): Free variables (closures)
- `get_nonlocals()` (L195-200): Nonlocal declarations

Uses lazy evaluation with private caching (`__params`, `__locals`, etc.) and bit manipulation for flag testing.

#### Class(SymbolTable) (L211-252)
Specialized symbol table for class scopes:
- `get_methods()` (L215-252): Returns tuple of method names, with complex logic to distinguish functions from generators and handle generic type parameters

#### Symbol (L255-353)
Represents individual identifiers with their binding properties:
- Scope classification: `is_global()`, `is_local()`, `is_free()`, `is_parameter()` 
- Binding type: `is_assigned()`, `is_imported()`, `is_referenced()`
- Namespace queries: `is_namespace()`, `get_namespace()`

## Dependencies
- `_symtable`: Low-level C extension providing raw symbol table data and constants
- `weakref`: For factory memoization to prevent memory leaks

## Architecture Patterns
- **Factory Pattern**: Automatic creation of appropriate SymbolTable subclasses
- **Lazy Initialization**: Symbol objects created on-demand in lookup()
- **Weak Reference Caching**: Factory memoization prevents duplicate objects
- **Bit Flag Analysis**: Extensive use of bitwise operations for symbol classification

## Critical Constraints
- Symbol flags use bit manipulation with SCOPE_OFF/SCOPE_MASK constants
- Factory memoization relies on (table, filename) tuple keys
- Class method detection includes complex generator/type parameter filtering logic