# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/pyclbr.py
@source-hash: e8ca09333701ba41
@generated: 2026-02-09T18:09:59Z

## Primary Purpose
Python module parser that extracts class and function definitions without importing/executing code. Builds an AST-based representation of module structure for IDE and development tool consumption.

## Core Classes & Data Models

**_Object (L53-64)** - Base class for all parsed entities
- Attributes: module, name, file, lineno, end_lineno, parent, children
- Automatically registers with parent.children on instantiation
- Foundation for hierarchical code structure representation

**Function (L68-75)** - Represents function/method definitions
- Extends _Object with `is_async` attribute for async functions
- Auto-registers with parent Class.methods if nested in class
- Backward-compatible constructor signature

**Class (L78-84)** - Represents class definitions  
- Extends _Object with `super` (superclass list) and `methods` (name->lineno mapping)
- Superclasses can be Class instances or strings (unresolved names)

## Key Functions

**readmodule_ex(module, path=None) (L112-119)** - Main public interface
- Returns dictionary of all top-level classes and functions in module
- Searches in path + sys.path, includes imported superclasses
- Delegates to internal _readmodule()

**readmodule(module, path=None) (L100-110)** - Legacy interface  
- Returns only Class objects (filters out Functions)
- Maintained for backward compatibility

**_readmodule(module, path, inpackage=None) (L122-183)** - Core parsing logic
- Handles module location, caching, package resolution
- Supports both top-level modules and submodules within packages
- Uses importlib.util for spec resolution, delegates AST parsing to _create_tree()

## AST Visitor Implementation

**_ModuleBrowser (L186-267)** - AST NodeVisitor that builds object tree
- `visit_ClassDef()` (L195-218): Resolves base classes, creates Class objects
- `visit_FunctionDef()` (L220-228): Creates Function objects, handles nesting
- `visit_AsyncFunctionDef()` (L230-231): Delegates to FunctionDef with is_async=True
- `visit_Import()` (L233-246): Processes import statements, recursively parses imported modules
- `visit_ImportFrom()` (L248-266): Handles from-import statements, including wildcard imports

## Architecture Patterns

**Module Caching**: Global `_modules` dict (L50) prevents redundant parsing of same modules

**Lazy Superclass Resolution**: Base classes stored as strings initially, resolved to Class objects when available in module tree

**Hierarchical Structure**: Uses parent/children relationships to represent nested classes/functions

**Error Resilience**: Import failures are handled gracefully - missing modules don't crash parsing

## Helper Functions

**_nest_function() (L89-92)** - Creates nested Function within parent object
**_nest_class() (L94-97)** - Creates nested Class within parent object  
**_create_tree() (L269-272)** - Orchestrates AST parsing via _ModuleBrowser
**_main() (L275-314)** - Command-line interface for visual inspection

## Dependencies
- ast: AST parsing and node visiting
- sys: builtin_module_names, path, argv  
- importlib.util: Module spec resolution and source loading

## Critical Constraints
- Only parses Python source files (returns empty for binary modules)
- Requires source code access via loader.get_source()
- Column offset filtering (col_offset != 0) skips nested imports
- Walrus operator usage (L202) requires Python 3.8+