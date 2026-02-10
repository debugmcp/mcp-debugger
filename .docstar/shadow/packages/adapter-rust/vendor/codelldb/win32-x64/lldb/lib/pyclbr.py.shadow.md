# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/pyclbr.py
@source-hash: e8ca09333701ba41
@generated: 2026-02-09T18:13:07Z

## pyclbr.py - Python Class Browser

**Primary Purpose**: Static analysis tool for Python modules to extract class and function definitions without importing/executing code. Part of Python's standard library for IDE and tool development.

### Core Public API

- **readmodule_ex(module, path=None)** (L112-119): Main entry point returning dictionary of all classes and functions
- **readmodule(module, path=None)** (L100-110): Legacy interface returning only top-level classes
- **_readmodule(module, path, inpackage=None)** (L122-183): Internal workhorse handling module discovery, caching, and parsing

### Data Model Classes

- **_Object** (L53-64): Base class for all parsed entities
  - Attributes: module, name, file, lineno, end_lineno, parent, children
  - Automatically registers with parent's children dict

- **Function(_Object)** (L68-75): Function/method representation
  - Additional attribute: is_async (bool)
  - Auto-registers with parent Class.methods if nested in class

- **Class(_Object)** (L78-84): Class representation  
  - Additional attributes: super (list of base classes), methods (dict)
  - Base classes resolved to Class instances when possible, strings otherwise

### AST Parsing Engine

- **_ModuleBrowser(ast.NodeVisitor)** (L186-267): AST visitor implementing the parsing logic
  - **visit_ClassDef** (L195-218): Handles class definitions, resolves inheritance
  - **visit_FunctionDef** (L220-228): Processes function definitions
  - **visit_AsyncFunctionDef** (L230-231): Handles async functions
  - **visit_Import/visit_ImportFrom** (L233-266): Processes imports to populate symbol table

### Key Architectural Decisions

- **Caching Strategy**: Global _modules dict (L50) caches parsed results to avoid reprocessing
- **Import Resolution**: Recursively parses imported modules to resolve inheritance chains
- **Error Tolerance**: Gracefully handles ImportError/SyntaxError during import resolution
- **Static Analysis Only**: Never imports/executes target code, works purely from source text

### Utility Functions

- **_nest_function/_nest_class** (L89-97): Helper factories for creating nested objects
- **_create_tree** (L269-272): Orchestrates AST parsing via _ModuleBrowser
- **_main** (L275-311): Debug utility for visual inspection of parsed modules

### Critical Constraints

- Only processes top-level imports (col_offset == 0 check in L234, L249)
- Requires source code access - returns empty tree for compiled-only modules
- Package discovery relies on __path__ attribute presence (L156)
- Inheritance resolution depends on import order and module availability