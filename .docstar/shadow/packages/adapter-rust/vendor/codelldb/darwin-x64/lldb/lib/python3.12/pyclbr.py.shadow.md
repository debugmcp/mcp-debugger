# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/pyclbr.py
@source-hash: e8ca09333701ba41
@generated: 2026-02-09T18:07:54Z

## Python Module Parser for Classes and Functions

**Primary Purpose**: Static code analysis tool that parses Python source files to extract class and function definitions without importing/executing the code. Used for code browsing, IDE features, and documentation generation.

### Core API Functions
- `readmodule_ex(module, path=None)` (L112-119): Main entry point returning dictionary of all classes and functions in a module
- `readmodule(module, path=None)` (L100-110): Legacy interface returning only top-level classes
- `_readmodule(module, path, inpackage=None)` (L122-183): Core implementation handling module resolution, caching, and parsing orchestration

### Data Model Classes
- `_Object` (L53-64): Base class for all parsed entities with common attributes (module, name, file, lineno, end_lineno, parent, children)
- `Class` (L78-84): Represents class definitions, extends _Object with `super` (superclass list) and `methods` (name→lineno mapping)
- `Function` (L68-75): Represents function/method definitions, extends _Object with `is_async` flag

### AST Visitor Implementation
- `_ModuleBrowser` (L186-267): AST NodeVisitor that walks parsed syntax tree and builds object hierarchy
  - `visit_ClassDef(node)` (L195-218): Handles class definitions, resolves inheritance chains
  - `visit_FunctionDef(node)` (L220-228): Processes function definitions, tracks async functions
  - `visit_Import(node)` (L233-246): Processes import statements, recursively parses imported modules
  - `visit_ImportFrom(node)` (L248-266): Handles from-import statements, including wildcard imports

### Key Architecture Patterns
- **Module Caching**: Global `_modules` dict (L50) prevents redundant parsing
- **Recursive Resolution**: Superclass inheritance chains resolved by recursive module parsing
- **Hierarchical Structure**: Parent-child relationships maintained via stack-based tracking during AST traversal
- **Import Following**: Import statements trigger recursive parsing of referenced modules

### Critical Dependencies
- `ast` module for Python source parsing
- `importlib.util` for module resolution and source loading
- `sys.path` integration for module discovery

### Helper Functions
- `_nest_function(ob, func_name, lineno, end_lineno, is_async=False)` (L89-92): Creates nested function objects
- `_nest_class(ob, class_name, lineno, end_lineno, super=None)` (L94-97): Creates nested class objects
- `_create_tree(fullmodule, path, fname, source, tree, inpackage)` (L269-272): Orchestrates AST parsing
- `_main()` (L275-311): Command-line interface for testing/debugging

### Usage Constraints
- Only parses Python source files (returns empty for binary modules)
- Requires readable source code via module loaders
- Inheritance resolution depends on ability to locate and parse imported modules
- Does not execute code, so dynamic class creation is not captured