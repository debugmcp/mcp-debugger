# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/modulefinder.py
@source-hash: e07ab000c3698a75
@generated: 2026-02-09T18:12:57Z

**Purpose:** Python module introspection tool that analyzes import dependencies by simulating module loading without executing code. Used for dependency analysis, packaging, and deployment planning.

**Architecture:**
- **Module class (L90-113):** Represents discovered modules with metadata (`__name__`, `__file__`, `__path__`, `__code__`) and tracking of global names and star imports
- **ModuleFinder class (L114-601):** Core analysis engine that simulates Python's import system
- **_find_module function (L45-88):** Modern importlib-based module discovery replacing deprecated `imp` module

**Key Functionality:**

**Module Discovery & Loading:**
- `find_module()` (L473-489): Locates modules using importlib.machinery.PathFinder with exclusion support
- `load_module()` (L324-351): Handles different module types (source, compiled, packages, extensions)
- `load_package()` (L446-466): Special handling for package initialization with `__path__` simulation

**Import Analysis:**
- `import_hook()` (L162-171): Main entry point simulating import statements
- `scan_code()` (L397-445): Bytecode analysis using `dis` module to find imports and assignments
- `scan_opcodes()` (L387-396): Extracts store operations and import statements from bytecode

**Dependency Resolution:**
- `determine_parent()` (L173-206): Resolves relative import contexts
- `find_head_package()` (L208-233): Handles dotted import paths
- `load_tail()` (L235-248): Recursively loads submodules
- `ensure_fromlist()` (L250-262): Processes `from module import names` statements

**Runtime Adaptation:**
- **Package path mapping (L27, L455-456):** `packagePathMap` allows runtime `__path__` modifications
- **Package replacement (L33, L448-450):** `replacePackageMap` handles module injection scenarios
- **Path replacement (L579-601):** Modifies code object filenames for deployment

**Error Handling:**
- `_safe_import_hook()` (L361-386): Wrapper preventing ImportError crashes
- `badmodules` tracking: Records failed imports with caller relationships
- `any_missing_maybe()` (L533-577): Distinguishes definite vs potential missing modules

**Reporting:**
- `report()` (L491-523): Human-readable dependency summary
- `any_missing()` (L525-531): Simple missing module list

**Constants (L13-19):** Legacy `imp` module compatibility for module types (_PY_SOURCE, _C_EXTENSION, etc.)

**Key Dependencies:**
- `importlib.machinery`: Modern module discovery
- `dis`: Bytecode analysis for import detection  
- `marshal`: Compiled bytecode loading
- `io.open_code`: Secure source file reading

**Usage Patterns:**
- Standalone script analysis via `run_script()` (L149-153)
- Module import simulation via `import_hook()`
- Batch analysis with exclusions and path modifications