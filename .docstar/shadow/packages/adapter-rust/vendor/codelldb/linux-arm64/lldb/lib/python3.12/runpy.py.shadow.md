# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/runpy.py
@source-hash: 81e07da29bb22351
@generated: 2026-02-09T18:09:12Z

## Purpose
Core Python module execution facility that enables running Python modules and scripts without importing them into the current namespace. Implements PEP 338 (Executing Modules as Scripts) and provides filesystem-agnostic execution through the module namespace.

## Key Classes & Context Managers

### _TempModule (L26-47)
Context manager that temporarily replaces a module in `sys.modules` with an empty namespace during execution. Used to isolate module execution without polluting the import system.
- `__enter__`: Saves existing module (if any) and installs temporary module
- `__exit__`: Restores original module or removes temporary entry

### _ModifiedArgv0 (L49-62) 
Context manager that temporarily modifies `sys.argv[0]` during execution to reflect the script being run. Includes sentinel-based protection against nested usage.

### _Error (L166-167)
Exception class for errors that should be reported without traceback in `_run_module_as_main`.

## Core Execution Functions

### _run_code (L65-89)
Low-level code execution helper that sets up module globals (__name__, __file__, __loader__, etc.) and executes code in the provided namespace. Handles both module specs and direct script execution.

### _run_module_code (L91-102)
Higher-level execution wrapper that creates isolated execution environment using `_TempModule` and `_ModifiedArgv0`. Returns copy of module globals to prevent reference issues.

### run_module (L201-229) - PUBLIC API
Main public interface for executing modules by name. Supports optional namespace pre-population and sys module isolation control via `alter_sys` parameter.

### run_path (L262-310) - PUBLIC API
Executes code from filesystem paths (scripts, zipfiles, directories with __main__.py). Handles both direct file execution and sys.path-based module discovery.

## Module Discovery & Validation

### _get_module_details (L105-164)
Comprehensive module resolution function that:
- Validates module names (no relative imports)
- Handles package imports and __main__ module discovery
- Provides detailed error messages for common issues
- Returns (mod_name, spec, code) tuple

### _get_main_module_details (L231-247)
Specialized version for __main__ module discovery, used when executing directories/zipfiles. Temporarily removes __main__ from sys.modules during discovery.

### _get_code_from_file (L250-260)
File-based code loading that attempts compiled bytecode first, falls back to source compilation.

## Internal Execution Function

### _run_module_as_main (L173-199)
Executes module in the actual __main__ namespace (not isolated). Used by Python's -m switch implementation. Handles argv modification and error reporting without tracebacks.

## Dependencies
- `importlib.machinery`, `importlib.util`: Modern import system integration
- `pkgutil`: Code reading and importer utilities  
- `io`: Code file reading with proper encoding handling
- `os`: Filesystem path operations

## Key Patterns
- Extensive use of context managers for safe resource/state management
- Graceful error handling with user-friendly messages for common mistakes
- Support for both isolated and __main__ namespace execution modes
- PEP 302 importer compatibility for non-filesystem module sources

## Critical Invariants
- Module execution must not pollute sys.modules permanently
- Original sys.argv[0] and module state must be restored on exit
- Package detection prevents direct execution, redirects to __main__ submodule
- Namespace packages cannot be executed (no loader available)