# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/runpy.py
@source-hash: 81e07da29bb22351
@generated: 2026-02-09T18:07:23Z

## runpy.py - Module Execution Infrastructure

**Primary Purpose:** Provides infrastructure for executing Python modules and scripts using the module namespace rather than direct filesystem access, implementing PEP 338 functionality.

**Public API:**
- `run_module()` (L201-229): Execute a module's code without importing it, with optional sys modifications
- `run_path()` (L262-310): Execute code from filesystem location (script, zipfile, or directory with __main__.py)

**Core Helper Classes:**

**_TempModule** (L26-47): Context manager for temporarily replacing modules in sys.modules
- Creates empty namespace module and restores original on exit
- Essential for isolated module execution without side effects

**_ModifiedArgv0** (L49-62): Context manager for temporarily modifying sys.argv[0] 
- Uses sentinel pattern to prevent nested modifications
- Restores original argv[0] value on context exit

**Key Internal Functions:**

**_run_code()** (L65-89): Core code execution helper
- Sets up module globals (__name__, __file__, __loader__, etc.)
- Executes code object in provided namespace via exec()

**_run_module_code()** (L91-102): High-level module execution with sys isolation
- Combines _TempModule and _ModifiedArgv0 for clean execution environment
- Returns copy of globals to prevent reference issues

**_get_module_details()** (L105-164): Module resolution and validation
- Handles relative imports (rejects them)
- Parent package import attempts with error handling
- Detects and handles packages vs modules, namespace packages
- Returns (mod_name, spec, code) tuple

**_run_module_as_main()** (L173-199): Internal function for -m switch execution
- Executes module in actual __main__ namespace (not isolated)
- Handles both module execution and directory/zipfile execution paths
- Uses custom _Error exception for clean error reporting

**_get_main_module_details()** (L231-247): Specialized __main__ module resolution
- Temporarily removes __main__ from sys.modules during lookup
- Provides better error messages for zipfile/directory execution failures

**_get_code_from_file()** (L250-260): File-based code loading
- Attempts compiled bytecode first via pkgutil.read_code
- Falls back to source compilation if bytecode unavailable
- Uses io.open_code() for proper encoding handling

**Architectural Patterns:**
- Heavy use of context managers for safe sys module manipulation
- Exception transformation pattern (ImportError -> custom errors)
- Fallback chain for code loading (bytecode -> source)
- Namespace isolation via temporary module replacement

**Dependencies:**
- importlib.util for module specification resolution
- pkgutil for code reading and importer detection
- io for file operations with proper encoding

**Critical Invariants:**
- sys.modules and sys.argv[0] must be restored after execution
- Package execution requires __main__.py submodule
- Namespace packages cannot be executed directly