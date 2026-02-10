# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/modulefinder.py
@source-hash: e07ab000c3698a75
@generated: 2026-02-09T18:08:51Z

## Module Analysis Tool for Python Import Dependencies

This module provides static analysis capabilities to discover module dependencies in Python scripts without executing them. It simulates Python's import mechanism to build a dependency graph.

### Core Components

**Module Class (L90-112)**
- Represents a Python module with metadata: `__name__`, `__file__`, `__path__`, `__code__`
- Tracks global names assigned in the module (`globalnames`)
- Records unresolved star imports (`starimports`)

**ModuleFinder Class (L114-601)**
Main analysis engine that simulates Python's import system:
- `__init__` (L116-126): Configures search paths, exclusions, debug level
- `run_script` (L149-153): Entry point for analyzing a Python script
- `import_hook` (L162-171): Core import simulation logic
- `scan_code` (L397-444): Bytecode analysis using `dis` module to find imports/stores
- `load_module` (L324-351): Handles different module types (source, compiled, packages)
- `find_module` (L473-489): Module discovery with exclusion filtering

### Key Algorithms

**Import Resolution Chain:**
1. `determine_parent` (L173-206): Resolves relative import contexts
2. `find_head_package` (L208-233): Splits dotted names and finds root package
3. `load_tail` (L235-248): Loads remaining package components
4. `ensure_fromlist` (L250-262): Handles `from module import names`

**Bytecode Analysis (L387-395):**
Uses `dis._find_imports()` and `dis._find_store_names()` to extract:
- Import statements (absolute/relative)
- Global name assignments

### Global Configuration

**Package Path Extensions (L27, L30-31):**
- `packagePathMap`: Runtime `__path__` additions
- `AddPackagePath()`: Public API for path registration

**Package Replacement (L33, L41-42):**
- `replacePackageMap`: Handle package name aliasing
- `ReplacePackage()`: Map real names to injected names

### Utility Functions

**`_find_module` (L45-87):**
Importlib-based module discovery returning file handle, path, and type information. Handles built-in, frozen, source, compiled, and extension modules.

**Reporting (L491-577):**
- `report()`: Formatted dependency analysis output
- `any_missing_maybe()`: Categorizes missing modules as definite vs. possible

### Dependencies
- `dis`: Bytecode disassembly for import detection
- `importlib`: Modern import machinery
- `marshal`: Compiled Python file loading
- Built on legacy `imp` constants for compatibility

### Architecture Notes
- Simulates import execution without running code
- Handles complex import scenarios: relative imports, star imports, package structures
- Provides debugging infrastructure with indented message logging
- Supports path replacement for relocated codebases