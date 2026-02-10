# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/importlib/util.py
@source-hash: 671f2995653f673f
@generated: 2026-02-09T18:11:12Z

## importlib.util - Import System Utilities

This module provides high-level utility functions and classes for Python's import system, building on the lower-level `_bootstrap` modules.

### Core Functions

**`source_hash(source_bytes)` (L19-21)**: Computes hash for source bytes using the raw magic number, primarily for hash-based pyc file validation.

**`resolve_name(name, package)` (L24-36)**: Converts relative module names (starting with '.') to absolute names by resolving dots against the package context. Raises ImportError if package is None for relative imports.

**`_find_spec_from_path(name, path=None)` (L39-67)**: Internal function that locates module specs, checking sys.modules first, then falling back to sys.meta_path search. Returns None if module not found, raises ValueError for malformed specs.

**`find_spec(name, package=None)` (L70-112)**: Main entry point for spec discovery. Handles relative names via resolve_name, automatically imports parent packages for submodules, and performs the same sys.modules/meta_path search as _find_spec_from_path.

### Extension Module Context Manager

**`_incompatible_extension_module_restrictions` (L119-166)**: Context manager for temporarily bypassing compatibility checks on extension modules in subinterpreters. Manages the `_imp._override_multi_interp_extensions_check()` state with proper restoration on exit. Used for development scenarios where extensions may not fully support multi-interpreter or per-interpreter GIL requirements.

### Lazy Loading System

**`_LazyModule(types.ModuleType)` (L168-229)**: Special module subclass that defers actual module loading until first attribute access. Key behaviors:
- `__getattribute__` (L172-221): Thread-safe loading trigger using loader_state lock
- Tracks attribute mutations between creation and loading
- Prevents recursive loading via 'is_loading' flag
- Validates module identity in sys.modules after loading
- `__delattr__` (L223-228): Ensures loading before deletion

**`LazyLoader(Loader)` (L231-270)**: Loader wrapper that creates lazy-loading modules:
- `factory()` (L240-244): Class method returning parameterized lazy loader constructor
- `exec_module()` (L253-270): Sets up lazy loading infrastructure with threading.RLock and loader_state tracking

### Dependencies

- Imports from `_bootstrap`: module_from_spec, _resolve_name, spec_from_loader, _find_spec
- Imports from `_bootstrap_external`: magic numbers, cache utilities, spec_from_file_location  
- Uses `_imp` module for low-level import operations
- Threading support for lazy loading synchronization

### Architecture Notes

The module serves as a high-level facade over Python's import machinery, providing both immediate utilities (spec finding, name resolution) and advanced features (lazy loading, extension compatibility management). The lazy loading system is particularly sophisticated, handling thread safety, attribute mutation tracking, and proper cleanup.