# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/runpy.py
@source-hash: 81e07da29bb22351
@generated: 2026-02-09T18:08:04Z

**Primary Purpose:** 
Implements Python module execution without importing, supporting PEP 338 (executing modules as scripts). Provides functionality to run modules and scripts using the Python module namespace instead of filesystem paths.

**Key Classes:**

- `_TempModule` (L26-47): Context manager that temporarily replaces a module in `sys.modules` with an empty namespace during execution. Creates temporary module, saves original if exists, and restores on exit.

- `_ModifiedArgv0` (L49-62): Context manager that temporarily modifies `sys.argv[0]` during execution, preserving the original value. Includes sentinel-based protection against nested usage.

- `_Error` (L166-167): Custom exception for `_run_module_as_main()` to report errors without traceback.

**Core Functions:**

- `_run_code` (L65-89): Helper that executes code in a specified namespace with proper module globals setup. Configures `__name__`, `__file__`, `__cached__`, `__loader__`, `__package__`, and `__spec__`.

- `_run_module_code` (L91-102): Executes code in a new namespace with `sys` modifications using `_TempModule` and `_ModifiedArgv0` context managers. Returns a copy of the module globals.

- `_get_module_details` (L105-164): Resolves module name to specification and code object. Handles package detection, relative imports (raises error), parent package importing, and various error cases. For packages, automatically looks for `__main__.py`.

- `run_module` (L201-229): **PUBLIC API** - Executes a module's code without importing it. Takes optional `init_globals`, `run_name`, and `alter_sys` parameters. Returns module globals dictionary.

- `run_path` (L262-310): **PUBLIC API** - Executes code at filesystem location (script, zipfile, or directory with `__main__.py`). Handles both direct file execution and sys.path-based execution.

- `_run_module_as_main` (L173-199): Internal function that runs module in `__main__` namespace. Used by Python's `-m` switch implementation.

- `_get_main_module_details` (L231-247): Helper for zipfile/directory execution, temporarily removes `__main__` from `sys.modules` to avoid loader conflicts.

- `_get_code_from_file` (L250-260): Loads code from file, trying compiled bytecode first, then source compilation.

**Dependencies:**
- `sys`, `importlib.machinery/util`, `io`, `os` for core functionality
- `pkgutil` for importer detection and code reading
- `warnings` for runtime warnings about module import conflicts

**Architectural Patterns:**
- Context managers for safe temporary modifications of global state
- Error handling with custom exception types for clean user-facing messages  
- Separation between public API (`run_module`, `run_path`) and internal helpers
- Support for both module namespace execution and filesystem-based execution

**Critical Invariants:**
- Module globals always include proper `__name__`, `__file__`, `__spec__` etc.
- `sys.modules` and `sys.argv[0]` are properly restored after execution
- Package execution automatically resolves to `__main__.py` submodule
- Relative module names are rejected (L106-107)

**Entry Point:**
Command-line usage when run as `__main__` (L313-319) allows direct module execution.