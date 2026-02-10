# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/pkgutil.py
@source-hash: 44300bc77f6f52ef
@generated: 2026-02-09T18:08:59Z

**Package Utilities Module**

This file provides core Python package discovery, loading, and resource access utilities. It's part of the standard library's import machinery support layer.

## Primary Components

**ModuleInfo namedtuple** (L22-23): Container for module metadata with fields `module_finder`, `name`, and `ispkg`.

**Module Discovery Functions**:
- `walk_packages()` (L39-94): Recursively yields ModuleInfo for all modules on given paths, importing packages to access submodules
- `iter_modules()` (L96-120): Non-recursive discovery of modules on specified paths or sys.path
- `iter_importer_modules()` (L122-126): Generic dispatcher for importer-specific module iteration

**Importer-Specific Implementations**:
- `_iter_file_finder_modules()` (L130-169): File system-based module discovery for FileFinder
- `iter_zipimport_modules()` (L178-205): ZIP archive module discovery for zipimporter

**Import System Integration**:
- `get_importer()` (L212-234): Retrieves cached finder for path item, creating via path hooks if needed
- `iter_importers()` (L237-263): Yields appropriate finders for module name, handling package hierarchy
- `get_loader()` (L266-291): **DEPRECATED** - Returns loader for module, wrapper around importlib
- `find_loader()` (L294-316): **DEPRECATED** - Finds loader via importlib.util.find_spec

**Package Extension**:
- `extend_path()` (L319-410): Extends package __path__ by scanning sys.path for subdirectories and .pkg files

**Resource Access**:
- `get_data()` (L413-453): Retrieves binary resource data from packages via PEP 302 loader interface
- `read_code()` (L26-36): Helper for reading compiled bytecode files with magic number validation

**Name Resolution**:
- `resolve_name()` (L458-529): Resolves dotted names to Python objects, supporting colon-separated package:object syntax

## Key Dependencies

- `importlib` ecosystem for modern import machinery
- `os`/`os.path` for filesystem operations  
- `zipimport` for ZIP archive support (optional)
- `inspect.getmodulename()` for filename-to-module mapping

## Notable Patterns

**Generic Dispatch**: Uses `@simplegeneric` decorator for `iter_importer_modules()` with type-specific registrations
**Error Handling**: Comprehensive exception handling in `walk_packages()` with optional error callback
**Caching**: Leverages `sys.path_importer_cache` for finder instances
**Backward Compatibility**: Maintains deprecated functions with warnings for migration to importlib

## Critical Constraints

- Path arguments must be lists, not strings (enforced in `iter_modules`)
- Relative module names not supported in several functions
- `extend_path()` only works with list-type paths (frozen packages return unchanged)
- Resource paths in `get_data()` use '/' separator and forbid parent directory references