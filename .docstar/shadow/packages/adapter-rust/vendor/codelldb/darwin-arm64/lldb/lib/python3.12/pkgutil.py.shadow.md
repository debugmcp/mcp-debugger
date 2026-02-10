# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/pkgutil.py
@source-hash: 44300bc77f6f52ef
@generated: 2026-02-09T18:07:21Z

## Core Purpose
Python package utilities module providing tools for package/module discovery, loading, and path manipulation. This is Python's standard `pkgutil` module implementing PEP 302 compatibility layers and package introspection functionality.

## Key Components

### Data Structures
- **ModuleInfo** (L22-23): Named tuple containing `(module_finder, name, ispkg)` for representing module metadata during discovery operations.

### Core Discovery Functions
- **walk_packages()** (L39-94): Recursively yields ModuleInfo for all modules on given paths or all accessible modules. Implements cycle detection via `seen()` closure (L68-71). Handles import errors via optional `onerror` callback.
- **iter_modules()** (L96-120): Yields ModuleInfo for immediate submodules on specified paths, using `iter_importer_modules()` dispatcher. Implements deduplication via `yielded` dict.

### Importer Interface
- **iter_importer_modules()** (L122-126): Single-dispatch generic function for extracting modules from different importer types.
- **_iter_file_finder_modules()** (L130-168): FileFinder implementation that scans filesystem directories, detecting packages by presence of `__init__.py` files.
- **iter_zipimport_modules()** (L178-204): zipimporter implementation for scanning ZIP archives, registered conditionally if zipimport available.

### Path/Loader Management
- **get_importer()** (L212-234): Retrieves cached finder for path item, creating via path hooks if needed. Uses `sys.path_importer_cache` for caching.
- **iter_importers()** (L237-263): Yields appropriate finders for given module name, handling both top-level and package-relative imports.
- **get_loader()** (L266-291): **DEPRECATED** - Returns loader for module, with deprecation warning pointing to `importlib.util.find_spec()`.
- **find_loader()** (L294-316): **DEPRECATED** - Backwards compatibility wrapper around `importlib.util.find_spec()`.

### Package Path Extension
- **extend_path()** (L319-410): Extends package `__path__` by scanning sys.path for matching subdirectories and `.pkg` files. Supports namespace packages and frozen packages.

### Resource Access
- **get_data()** (L413-453): Retrieves binary resource data from packages using PEP 302 loader interface. Handles path normalization from '/' separators to os.path format.

### Name Resolution
- **resolve_name()** (L458-529): Resolves dotted names to objects, supporting both legacy format (`pkg.module.obj`) and explicit format (`pkg.module:obj`). Uses lazy-compiled regex pattern (L490-497).

## Key Dependencies
- **importlib**: Core import machinery integration
- **inspect**: Module name extraction from filenames
- **zipimport**: Optional ZIP archive support
- **marshal**: Bytecode reading for PEP 302 emulation

## Architecture Patterns
- **Single dispatch**: `iter_importer_modules()` uses `@simplegeneric` for type-based method dispatch
- **Lazy initialization**: Regex pattern compiled on first use in `resolve_name()`
- **Caching**: Leverages `sys.path_importer_cache` for importer reuse
- **Error resilience**: Graceful handling of unreadable directories and import failures

## Critical Constraints
- Relative module names (starting with '.') explicitly rejected in several functions
- Path arguments must be lists, not strings, in `iter_modules()`
- Resource names in `get_data()` cannot use '..' or start with '/'
- Frozen packages return unchanged paths from `extend_path()`