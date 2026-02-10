# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/pyclbr.py
@source-hash: e8ca09333701ba41
@generated: 2026-02-09T18:07:20Z

## Primary Purpose
Python module parser that extracts class and function definitions from source code without executing it. Used for code analysis, introspection, and IDE features like code browsers.

## Core Classes and Objects

### _Object (L53-65)
Base class for parsed code objects. Stores essential metadata:
- `module`, `name`, `file`, `lineno`, `end_lineno`, `parent` attributes
- `children` dict for nested objects
- Auto-registers with parent's children on construction

### Function (L68-76) 
Represents function/method definitions, extends _Object:
- `is_async` flag for async functions
- Auto-registers methods with parent Class.methods dict

### Class (L78-85)
Represents class definitions, extends _Object:
- `super` list containing superclass references (Class instances or strings)
- `methods` dict mapping method names to line numbers

## Main API Functions

### readmodule_ex(module, path=None) (L112-119)
Primary interface - returns dict of all classes and functions in a module.
Delegates to internal `_readmodule()`.

### readmodule(module, path=None) (L100-110)
Legacy interface - returns only top-level classes (filters out functions).

## Core Implementation

### _readmodule(module, path, inpackage=None) (L122-183)
Main parsing engine with caching via `_modules` global dict (L50):
1. Handles dotted module names recursively
2. Uses importlib.util for module discovery
3. Extracts source code via loader
4. Delegates AST parsing to `_create_tree()`

### _ModuleBrowser (L186-267)
AST NodeVisitor that builds the object tree:
- `visit_ClassDef()` (L195-218): Resolves superclasses, creates Class objects
- `visit_FunctionDef()` (L220-228): Creates Function objects  
- `visit_AsyncFunctionDef()` (L230-231): Handles async functions
- `visit_Import()` (L233-246): Processes import statements
- `visit_ImportFrom()` (L248-266): Handles from-imports including star imports
- Uses `stack` to track nested scopes

## Utility Functions

### _nest_function() and _nest_class() (L89-97)
Helper functions for creating nested objects within a parent scope.

### _create_tree() (L269-272)  
Orchestrates AST parsing via _ModuleBrowser.

### _main() (L275-314)
Debug utility that pretty-prints module structure.

## Key Architectural Decisions

- **Caching**: Global `_modules` dict prevents re-parsing
- **Lazy superclass resolution**: Stores strings when Class objects unavailable
- **Source-only parsing**: Never imports/executes code for safety
- **Nested scope tracking**: Stack-based approach for handling nested classes/functions
- **Import handling**: Attempts to resolve imported names for better superclass analysis

## Dependencies
- `ast`: Core AST parsing
- `importlib.util`: Module discovery and source loading  
- `sys`: Built-in module detection and path handling

## Critical Constraints
- Only processes Python source files (skips compiled modules)
- Top-level imports only (ignores indented imports via `col_offset` check)
- Graceful degradation on import/parsing failures