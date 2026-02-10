# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/pkgutil.py
@source-hash: 44300bc77f6f52ef
@generated: 2026-02-09T18:07:53Z

## Purpose
Python standard library module providing utilities for package discovery, module enumeration, and resource access. Part of the import machinery infrastructure, specifically focused on package-related operations.

## Key Components

### Core Data Structures
- **ModuleInfo (L22-23)**: Named tuple containing `module_finder`, `name`, and `ispkg` fields for representing module metadata

### Module Discovery Functions
- **walk_packages (L39-93)**: Recursively discovers all modules/packages on given path(s), yielding ModuleInfo instances. Handles import errors via optional error callback. Uses nested closure `seen()` (L68-71) to avoid duplicate traversal
- **iter_modules (L96-119)**: Non-recursive module enumeration, yielding ModuleInfo for immediate children of path(s)
- **iter_importers (L237-263)**: Yields appropriate finders/importers for a given module name, handling both meta_path and path-based importers

### Importer Integration
- **get_importer (L212-234)**: Retrieves cached finder for path item, consulting sys.path_importer_cache and sys.path_hooks
- **iter_importer_modules (L122-126)**: Generic dispatcher using @simplegeneric decorator for importer-specific module iteration
- **_iter_file_finder_modules (L130-171)**: File system walker for FileFinder, detecting packages via __init__.py presence
- **iter_zipimport_modules (L178-204)**: ZIP archive module discovery (conditionally imported L174-209)

### Legacy Loader Interface (Deprecated)
- **get_loader (L266-291)**: Returns loader object for module, with deprecation warnings pointing to importlib.util.find_spec()
- **find_loader (L294-316)**: Backwards compatibility wrapper around importlib.util.find_spec()

### Package Path Extension
- **extend_path (L319-410)**: Extends package __path__ by discovering additional package portions across sys.path and processing .pkg files. Handles nested packages and frozen package edge cases

### Resource Access
- **get_data (L413-453)**: Retrieves binary data from package resources using PEP 302 loader interface
- **read_code (L26-36)**: Reads compiled Python bytecode, validating magic number and skipping header

### Name Resolution
- **resolve_name (L458-529)**: Resolves dotted names to objects, supporting both legacy format (pkg.module.obj) and explicit format (pkg.module:obj). Uses lazy-compiled regex pattern (_NAME_PATTERN, L456)

## Key Dependencies
- importlib ecosystem (importlib.util, importlib.machinery, importlib._bootstrap)
- Standard library: os, sys, marshal, inspect, warnings
- Optional: zipimport for ZIP file support

## Architectural Patterns
- Generic dispatch via functools.singledispatch for importer-specific behavior
- Lazy initialization of regex patterns for performance
- Extensive error handling with fallback strategies
- Caching integration with sys.path_importer_cache
- Deprecation warnings for legacy APIs directing users to modern importlib equivalents