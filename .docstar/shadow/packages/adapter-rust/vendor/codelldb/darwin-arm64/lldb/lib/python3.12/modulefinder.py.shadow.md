# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/modulefinder.py
@source-hash: e07ab000c3698a75
@generated: 2026-02-09T18:07:19Z

## Primary Purpose
Python module dependency analyzer that uses static bytecode analysis to discover module imports without executing code. Part of Python's standard library, used by tools like cx_Freeze and py2exe for packaging applications.

## Core Classes

### Module (L90-112)
Represents a discovered module with metadata:
- `__name__`, `__file__`, `__path__`: Standard module attributes
- `globalnames`: Dict of global names assigned in the module (including from star imports)
- `starimports`: Dict of unresolved star imports from non-Python modules

### ModuleFinder (L114-601) 
Main analyzer class that simulates Python's import mechanism:
- **Initialization (L116-126)**: Takes path, debug level, excludes list, replace_paths
- **Core Discovery Methods**:
  - `run_script(pathname)` (L149-153): Analyzes a Python script as `__main__`
  - `import_hook(name, caller, fromlist, level)` (L162-171): Simulates import statements
  - `load_module(fqname, fp, pathname, file_info)` (L324-351): Loads and analyzes module bytecode
- **Import Resolution**:
  - `find_head_package(parent, name)` (L208-233): Resolves dotted import names
  - `determine_parent(caller, level)` (L173-206): Handles relative imports
  - `ensure_fromlist(m, fromlist)` (L250-262): Processes `from X import Y` statements
- **Bytecode Analysis**:
  - `scan_code(co, m)` (L397-444): Analyzes bytecode for import/assignment opcodes
  - `scan_opcodes(co)` (L387-395): Extracts import and store operations from bytecode
- **Reporting**:
  - `report()` (L491-523): Prints discovered modules and missing dependencies
  - `any_missing_maybe()` (L533-577): Categorizes missing modules (certain vs. possible)

## Key Functions

### _find_module(name, path) (L45-87)
Importlib-based reimplementation of deprecated `imp.find_module()`. Returns file handle, pathname, and module type constants (_PY_SOURCE, _C_EXTENSION, etc.).

### AddPackagePath(packagename, path) (L30-31)
Public API to register additional search paths for packages that modify `__path__` at runtime.

### ReplacePackage(oldname, newname) (L41-42)
Public API to handle packages that inject themselves into `sys.modules` under different names.

## Architecture & Patterns

**Static Analysis Approach**: Uses `dis` module to examine bytecode without execution, identifying import statements and global assignments.

**Module Type Classification**: Distinguishes between source files, compiled bytecode, C extensions, packages, built-ins, and frozen modules using importlib machinery.

**Recursive Discovery**: Follows import chains, handling both absolute and relative imports, including complex cases like `from package import *`.

**Error Tolerance**: Continues analysis even when modules are missing, tracking failures in `badmodules` dict for reporting.

## Dependencies
- `dis`: Bytecode disassembly for finding imports/stores
- `importlib.machinery`: Modern import system interfaces
- `importlib._bootstrap_external`: Bytecode validation
- `marshal`: Deserializing compiled Python files
- Standard library: `os`, `sys`, `io`

## Global State
- `packagePathMap` (L27): Registry for runtime package path modifications  
- `replacePackageMap` (L33): Registry for package name substitutions
- Module type constants (L13-19): Legacy `imp` module compatibility

## Critical Invariants
- Modules are cached in `self.modules` to prevent re-analysis
- Failed imports tracked in `self.badmodules` with caller relationships
- Package `__path__` handling includes both static and registered runtime modifications
- Bytecode analysis handles nested code objects (functions, classes) recursively