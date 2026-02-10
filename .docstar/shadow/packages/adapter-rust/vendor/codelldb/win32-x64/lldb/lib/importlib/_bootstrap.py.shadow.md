# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/importlib/_bootstrap.py
@source-hash: 9653944363a4773c
@generated: 2026-02-09T18:11:18Z

## Core Python Import Bootstrap Implementation

This module implements Python's core import machinery and is designed to be frozen/compiled into the Python interpreter. It provides the fundamental infrastructure for module loading, import locks, and module specifications.

**Primary Purpose:** Bootstrap implementation of Python's import system, providing core functionality that gets frozen into the interpreter binary.

### Module-Level Locking Infrastructure

**_ModuleLock (L226-387):** Thread-safe recursive lock for individual modules with deadlock detection. Uses RLock internally and tracks ownership via thread ID. Implements deadlock detection algorithm by analyzing dependency chains in `_blocking_on` global state.

**_DummyModuleLock (L389-408):** Simple non-threaded version of module lock for Python builds without threading support. Uses basic reference counting instead of thread synchronization.

**_ModuleLockManager (L410-422):** Context manager for acquiring/releasing module locks automatically. Used throughout import process for thread safety.

**_get_module_lock() (L426-460):** Factory function that creates and manages module locks using weak references. Handles cleanup via weakref callbacks when modules are garbage collected.

### Import Machinery Core

**__import__() (L1454-1488):** The main import function that handles both absolute and relative imports. Processes fromlist, level-based relative imports, and delegates to `_gcd_import()` for actual loading.

**_gcd_import() (L1375-1387):** Greatest common denominator import function that handles name resolution and delegates to `_find_and_load()`. Central entry point for both `import_module()` and `__import__()`.

**_find_and_load() (L1349-1372):** Optimized module loading with caching checks. Avoids unnecessary locking for already-loaded modules and handles module initialization state.

**_find_spec() (L1240-1282):** Searches through `sys.meta_path` to find module specifications. Handles reload detection and module spec caching.

### Module Specifications

**ModuleSpec (L562-660):** Complete specification for module loading containing name, loader, origin, and package information. Includes properties for `parent`, `cached`, and `has_location` with lazy evaluation.

**spec_from_loader() (L662-688):** Creates ModuleSpec instances from loader objects, with automatic detection of package status and file locations.

**module_from_spec() (L806-820):** Factory function that creates module objects from specifications, delegating to loader's `create_module()` method when available.

### Built-in Module Loaders

**BuiltinImporter (L971-1021):** Meta path finder and loader for built-in modules. Implements `find_spec()`, `create_module()`, and `exec_module()` for modules compiled into Python interpreter.

**FrozenImporter (L1023-1214):** Meta path finder and loader for frozen modules. Handles stdlib modules that are frozen into the interpreter, with complex filename resolution for proper `__file__` attributes.

### Utility Functions

**_call_with_frames_removed() (L480-488):** Special function for stack trace manipulation - import.c removes importlib frames ending with calls to this function.

**_verbose_message() (L491-496):** Debug output for import operations when `-v` flag is used.

**_wrap() (L40-45):** Simple substitute for `functools.update_wrapper` used during bootstrap when functools isn't available yet.

### Bootstrap Setup

**_setup() (L1498-1535):** Critical bootstrap function that injects required modules (`_thread`, `_warnings`, `_weakref`) into global namespace and sets up module specs for existing built-in/frozen modules.

**_install() (L1538-1543):** Installs the built-in importers into `sys.meta_path` after bootstrap setup.

### Global State

- `_module_locks` (L140): Dictionary mapping module names to weakrefs of lock instances
- `_blocking_on` (L153): WeakValueDictionary tracking thread blocking relationships for deadlock detection
- `_bootstrap_external` (L37): Reference to external filesystem import machinery, set by `_install_external_importers()`

### Key Architectural Constraints

- No imports allowed during module-level execution (L19-21)
- Injected objects cannot be referenced during class definition (L19-21) 
- Must work during early Python interpreter bootstrap before standard library is available
- Thread-safety required for concurrent imports with deadlock detection