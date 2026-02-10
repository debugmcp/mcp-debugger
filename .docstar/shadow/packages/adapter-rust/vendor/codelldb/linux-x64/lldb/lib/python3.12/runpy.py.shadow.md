# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/runpy.py
@source-hash: 81e07da29bb22351
@generated: 2026-02-09T18:10:02Z

## Purpose
Core Python module execution infrastructure implementing PEP 338. Enables execution of Python modules and scripts using the module namespace instead of direct filesystem access, supporting PEP 302 importers and non-filesystem module sources.

## Key Components

### Context Manager Classes
- **_TempModule (L26-47)**: Temporarily replaces a module in `sys.modules` with an empty namespace during execution, preserving and restoring original module state
- **_ModifiedArgv0 (L49-62)**: Temporarily modifies `sys.argv[0]` during execution, with sentinel-based protection against nested usage

### Core Execution Functions
- **_run_code (L65-89)**: Low-level code execution helper that sets up module globals (`__name__`, `__file__`, `__loader__`, etc.) and executes code in the specified namespace
- **_run_module_code (L91-102)**: Higher-level execution wrapper that creates temporary module context and modified argv, returning copied globals
- **run_module (L201-229)**: Public API for executing modules without importing them, with options for global initialization and sys module modification
- **run_path (L262-310)**: Public API for executing code from filesystem paths, handling both direct files and importable packages

### Module Resolution
- **_get_module_details (L105-164)**: Comprehensive module resolution that handles relative imports, package detection, namespace packages, and error conversion. Returns module name, spec, and compiled code
- **_get_main_module_details (L231-247)**: Specialized resolver for `__main__` module execution with enhanced error messages

### Utilities
- **_get_code_from_file (L250-260)**: File-based code loading that attempts compiled bytecode first, falls back to source compilation
- **_Error (L166-167)**: Custom exception class for clean error reporting without tracebacks
- **_run_module_as_main (L173-199)**: Internal function for executing modules in `__main__` namespace with argv modification

## Key Dependencies
- `importlib.util` and `importlib.machinery` for module resolution
- `pkgutil` for code reading and importer detection
- `io.open_code()` for secure code file access

## Architectural Patterns
- Context managers for safe temporary state modification
- Layered execution model: `_run_code` → `_run_module_code` → public APIs
- Comprehensive error handling with custom exception types
- Module spec-based execution supporting modern Python import system

## Critical Invariants
- Always restore `sys.modules` and `sys.argv` state after execution
- Package modules cannot be executed directly (must use `__main__.py`)
- Namespace packages cannot be executed
- Relative module names are explicitly rejected

## Command Line Interface
Direct execution support (L313-319) for running modules via `python -m runpy module_name`