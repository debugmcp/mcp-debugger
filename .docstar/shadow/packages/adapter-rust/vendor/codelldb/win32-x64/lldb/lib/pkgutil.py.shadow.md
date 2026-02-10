# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/pkgutil.py
@source-hash: 44300bc77f6f52ef
@generated: 2026-02-09T18:13:22Z

**Primary Purpose:**
This file provides utilities for introspecting Python packages and modules, offering functionality for module discovery, loading, and package path manipulation. It serves as a compatibility layer between older PEP 302 mechanisms and modern importlib functionality.

**Key Classes and Data Structures:**
- `ModuleInfo` (L22): Named tuple containing `module_finder`, `name`, and `ispkg` fields for representing basic module metadata

**Core Functions:**

**Module Discovery:**
- `walk_packages(path=None, prefix='', onerror=None)` (L39-94): Recursively yields ModuleInfo for all modules/packages on given path or sys.path. Uses seen() closure to prevent infinite loops
- `iter_modules(path=None, prefix='')` (L96-120): Yields ModuleInfo for immediate submodules on path, delegates to iter_importers()
- `iter_importers(fullname="")` (L237-263): Yields appropriate finders/importers for a module name, handling both top-level and package-nested modules

**Importer-Specific Discovery:**
- `iter_importer_modules(importer, prefix='')` (L122-126): Single-dispatch generic function for extracting modules from different importer types
- `_iter_file_finder_modules(importer, prefix='')` (L130-168): File system walker for FileFinder importers, handles both modules and packages
- `iter_zipimport_modules(importer, prefix='')` (L178-205): ZIP archive walker for zipimporter, conditionally registered if zipimport available

**Module Loading (Deprecated):**
- `get_loader(module_or_name)` (L266-291): Deprecated wrapper returning module loader, issues deprecation warning for removal in Python 3.14
- `find_loader(fullname)` (L294-316): Deprecated wrapper around importlib.util.find_spec(), converts exceptions to ImportError

**Utility Functions:**
- `get_importer(path_item)` (L212-234): Retrieves and caches finder for path item using sys.path_hooks
- `read_code(stream)` (L26-36): Reads compiled Python bytecode from stream, validates magic number
- `extend_path(path, name)` (L319-410): Extends package __path__ by searching sys.path for matching subdirectories and .pkg files
- `get_data(package, resource)` (L413-453): Retrieves binary resource data from package using PEP 302 loader API
- `resolve_name(name)` (L458-529): Resolves dotted names to objects, supports both legacy format and explicit package:object format

**Dependencies:**
- Standard library: collections, functools, importlib, os, sys, types, warnings, marshal, inspect
- Optional: zipimport (gracefully handles ImportError)
- Uses regex for name pattern matching (lazy imported)

**Architecture Patterns:**
- Single-dispatch generic functions for importer-specific behavior
- Extensive use of sys.modules and import machinery introspection  
- Caching mechanisms (sys.path_importer_cache, yielded sets)
- Deprecation warnings for legacy APIs transitioning to importlib

**Critical Invariants:**
- Module names cannot be relative (start with '.')
- Path items are converted to fs-decoded strings
- Duplicate module detection via yielded dictionaries
- FileFinder requires valid directory paths
- Package __path__ extension preserves original list immutability