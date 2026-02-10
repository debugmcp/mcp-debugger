# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/runpy.py
@source-hash: 81e07da29bb22351
@generated: 2026-02-09T18:13:07Z

## Purpose

Standard Python module implementing PEP 338 functionality for executing modules and scripts using the Python module namespace instead of direct filesystem access. This is the canonical implementation used by `python -m` and enables execution of modules, packages, and filesystem paths while properly managing module namespaces.

## Key Classes

**_TempModule (L26-48)**: Context manager that temporarily replaces a module in `sys.modules` with an empty namespace during execution. Uses `__enter__`/`__exit__` to save/restore the original module state, enabling safe temporary module substitution.

**_ModifiedArgv0 (L49-63)**: Context manager that temporarily modifies `sys.argv[0]` during code execution. Implements sentinel-based protection against nested usage and ensures proper restoration of the original argv value.

**_Error (L166-168)**: Custom exception class for internal error handling that should be reported without traceback in `_run_module_as_main()`.

## Core Functions

**run_module (L201-229)**: Primary public API for executing a module's code without importing it. Supports pre-populated globals, custom `__name__` setting, and optional sys module modification. Returns the resulting module globals dictionary.

**run_path (L262-311)**: Public API for executing code from filesystem paths (scripts, zipfiles, or directories with `__main__.py`). Handles both direct file execution and sys.path-based module discovery with proper cleanup.

**_run_module_as_main (L173-199)**: Internal function used by Python interpreter for `-m` switch execution. Runs modules in the actual `__main__` namespace with full access, handling both module execution and directory/zipfile execution cases.

## Helper Functions

**_run_code (L65-89)**: Core execution helper that runs code in a specified namespace with proper module metadata setup (`__name__`, `__file__`, `__loader__`, etc.).

**_run_module_code (L91-102)**: Wrapper around `_run_code` that uses temporary module and argv modification context managers for isolated execution.

**_get_module_details (L105-164)**: Complex module resolution function that handles relative imports, package detection, namespace packages, and various error conditions. Returns module name, spec, and compiled code object.

**_get_main_module_details (L231-247)**: Specialized helper for resolving `__main__` modules in directory/zipfile contexts, with proper error handling for missing `__main__.py` files.

**_get_code_from_file (L250-260)**: File-based code loading with fallback from compiled bytecode to source compilation.

## Dependencies

- `importlib.machinery`, `importlib.util`: Module system integration
- `pkgutil`: Code reading and import utilities  
- `sys`, `os`, `io`: System integration and file operations

## Key Patterns

- Extensive use of context managers for safe resource management
- Sophisticated error handling with custom exception types and error message formatting
- Support for both module namespace execution and direct filesystem execution
- Careful `sys.modules` and `sys.argv` manipulation with proper restoration

## Critical Invariants

- Module execution must not pollute `sys.modules` permanently
- Original `sys.argv[0]` must be restored after execution
- Package modules require `__main__.py` submodule for execution
- Namespace packages cannot be directly executed