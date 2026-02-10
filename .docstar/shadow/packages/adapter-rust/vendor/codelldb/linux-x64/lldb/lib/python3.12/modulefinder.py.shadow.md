# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/modulefinder.py
@source-hash: e07ab000c3698a75
@generated: 2026-02-09T18:10:23Z

## Purpose
Python module introspection tool that analyzes Python scripts and modules to discover their dependencies by simulating the import process without actually executing code. Part of Python's standard library for static analysis of module dependencies.

## Core Classes

### Module (L90-113)
Represents a discovered module with metadata:
- `__name__`, `__file__`, `__path__` attributes mirror real module objects
- `globalnames`: dict tracking global names assigned in the module
- `starimports`: dict tracking unresolved star imports from non-Python modules
- Used as lightweight proxy for actual modules during analysis

### ModuleFinder (L114-601)
Main analysis engine that simulates Python's import mechanism:
- **Constructor (L116-126)**: Takes path, debug level, excludes list, and path replacements
- **Core state**: `modules` (found), `badmodules` (failed imports), `excludes` (ignored)

#### Import Simulation Methods
- `import_hook()` (L162-171): Main entry point simulating import statement
- `determine_parent()` (L173-206): Resolves relative import contexts  
- `find_head_package()` (L208-233): Splits dotted imports, finds root package
- `load_tail()` (L235-248): Loads remaining dotted path components
- `import_module()` (L292-322): Core module loading with caching
- `find_module()` (L473-489): Locates module files, delegates to `_find_module()`

#### Code Analysis
- `scan_code()` (L397-444): Analyzes bytecode for imports and global assignments
- `scan_opcodes()` (L387-395): Extracts import/store operations from bytecode using `dis` module
- Handles absolute imports, relative imports, and star imports differently

#### Package Handling  
- `load_package()` (L446-465): Special handling for package directories
- `find_all_submodules()` (L264-290): Discovers submodules by filesystem scanning
- `ensure_fromlist()` (L250-262): Processes `from module import x, y` lists

## Key Functions

### _find_module() (L45-88)
Modern replacement for deprecated `imp.find_module()`:
- Uses `importlib.machinery.PathFinder` for module location
- Returns file handle, path, and module type classification
- Handles builtin, frozen, source, compiled, and extension modules
- Maps to legacy constants (`_PY_SOURCE`, `_C_EXTENSION`, etc.)

### Global Configuration
- `AddPackagePath()` (L30-31): Registers additional paths for packages
- `ReplacePackage()` (L41-42): Maps fake package names to real ones
- `packagePathMap`, `replacePackageMap`: Global registries for runtime path modifications

## Architecture Patterns

**Static Analysis Approach**: Analyzes bytecode rather than executing code, avoiding side effects while discovering dependencies.

**Import Simulation**: Replicates Python's import machinery behavior including:
- Module caching in `modules` dict
- Path resolution with `sys.path` 
- Relative import level calculations
- Package vs module distinction

**Error Resilience**: Failed imports recorded in `badmodules` rather than stopping analysis, enabling partial dependency discovery.

**Extensibility**: Global maps allow external code to register package path modifications and name replacements.

## Dependencies
- `dis`: Bytecode analysis for finding imports/stores
- `importlib.machinery`: Modern import infrastructure  
- `importlib._bootstrap_external`: Bytecode validation
- `marshal`: Compiled Python file loading
- `os`, `io`, `sys`: File system and runtime integration

## Usage Context
Typically used by build tools, bundlers, and dependency analyzers that need to understand module relationships without executing potentially unsafe code. The `test()` function (L603-659) provides a command-line interface for standalone usage.