# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/modulefinder.py
@source-hash: e07ab000c3698a75
@generated: 2026-02-09T18:07:54Z

**Primary Purpose**: ModuleFinder analyzes Python scripts to discover imported modules through static analysis and bytecode introspection. It simulates Python's import mechanism to build a dependency graph without executing code, used for creating standalone executables or analyzing module dependencies.

## Core Classes

**Module (L90-113)**: Lightweight wrapper representing a discovered module with attributes:
- `__name__`, `__file__`, `__path__` mirror real module attributes  
- `globalnames` dict tracks names assigned in module scope
- `starimports` dict tracks unresolved star imports from non-Python modules

**ModuleFinder (L114-601)**: Main analysis engine that simulates Python's import system:
- `modules` dict stores discovered Module instances by fully qualified name
- `badmodules` dict tracks failed imports with caller context
- `excludes` list prevents analysis of specified modules
- `replace_paths` allows path rewriting in bytecode

## Key Methods

**Import Simulation**:
- `import_hook()` (L162-171): Entry point for import analysis, handles relative/absolute imports
- `determine_parent()` (L173-206): Resolves parent package for relative imports using dot notation
- `find_head_package()` (L208-233): Splits dotted names, finds root package
- `load_tail()` (L235-248): Recursively loads submodules in dotted import paths

**Module Discovery**:
- `find_module()` (L473-489): Locates modules using `_find_module()` helper, respects excludes
- `load_module()` (L324-351): Loads and compiles Python source/bytecode, handles packages
- `load_package()` (L446-465): Special handling for packages, loads `__init__.py`

**Bytecode Analysis**:
- `scan_code()` (L397-444): Analyzes compiled bytecode using `dis` module to find imports
- `scan_opcodes()` (L387-395): Yields import opcodes and store operations from bytecode
- `_safe_import_hook()` (L361-385): Import wrapper that catches and logs errors

**Reporting**:
- `report()` (L491-523): Generates human-readable dependency report
- `any_missing_maybe()` (L533-577): Categorizes missing modules as definite vs. possible

## Global Configuration

**packagePathMap** (L27): Dict mapping package names to additional search paths for runtime `__path__` modifications

**replacePackageMap** (L33): Maps real package names to fake names for packages that inject themselves into `sys.modules`

**Public APIs**: `AddPackagePath()` (L30-31), `ReplacePackage()` (L41-42)

## Helper Functions

**_find_module()** (L45-87): Importlib-based replacement for deprecated `imp.find_module()`, handles:
- Cache invalidation via `PathFinder.invalidate_caches()`
- Special cases: builtin, frozen, extension modules
- Returns (file, path, description) tuple matching old `imp` interface

**Module Type Constants** (L13-19): Legacy `imp` module constants for module types (`_PY_SOURCE`, `_C_EXTENSION`, etc.)

## Architecture Notes

- Uses bytecode disassembly instead of AST parsing for import detection
- Maintains separate tracking of definite vs. uncertain missing modules
- Supports path replacement for deployment scenarios
- Handles complex import patterns: relative imports, star imports, package namespaces
- Extensive debug logging system with indented output

## Dependencies

- `dis` module for bytecode analysis
- `importlib.machinery` for modern import system integration  
- `marshal` for compiled Python bytecode loading
- Standard library modules: `os`, `sys`, `io` for file system operations