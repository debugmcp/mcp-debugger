# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/pkgutil.py
@source-hash: 44300bc77f6f52ef
@generated: 2026-02-09T18:10:20Z

## Purpose
Core Python package utilities module providing introspection, discovery, and manipulation of Python packages and modules. Part of the Python 3.12 standard library in an LLDB debugging environment.

## Key Components

### Data Structures
- **ModuleInfo** (L22-23): namedtuple('module_finder name ispkg') - minimal module metadata container

### Module Discovery & Walking
- **walk_packages()** (L39-93): Recursively yields ModuleInfo for all modules on given paths or all accessible modules. Imports packages to access __path__ for submodule discovery. Handles error callbacks via onerror parameter.
- **iter_modules()** (L96-119): Non-recursive iteration over modules in specified paths or sys.path. Uses importers to find modules and deduplicates results.
- **iter_importers()** (L237-263): Yields appropriate finders for a given module name, handling both top-level and package-nested modules.

### Importer Integration
- **iter_importer_modules()** (L122-126): Single-dispatch generic function for extracting modules from different importer types
- **_iter_file_finder_modules()** (L130-168): FileFinder implementation for filesystem-based module discovery
- **iter_zipimport_modules()** (L178-204): ZIP archive module discovery (when zipimport available)

### Legacy Loader Functions (Deprecated)
- **get_loader()** (L266-291): Deprecated wrapper around importlib for getting module loaders
- **find_loader()** (L294-316): Deprecated backwards compatibility wrapper for importlib.util.find_spec()

### Utility Functions
- **read_code()** (L26-36): Reads compiled Python bytecode from streams, validates magic number
- **get_importer()** (L212-234): Retrieves cached finders from sys.path_importer_cache or creates new ones
- **extend_path()** (L319-410): Extends package __path__ by scanning sys.path for matching subdirectories and .pkg files
- **get_data()** (L413-453): Resource loading from packages via PEP 302 loader interface
- **resolve_name()** (L458-529): String-to-object resolution supporting both legacy dotted names and package:object syntax

## Dependencies
- importlib ecosystem (util, machinery, _bootstrap)
- Standard library: os, sys, marshal, inspect, warnings, re
- Optional: zipimport for ZIP archive support

## Architecture Patterns
- Single-dispatch generic functions for extensible importer support
- Caching via sys.path_importer_cache for performance
- Generator-based lazy evaluation for large module trees
- Error handling with optional callbacks for robust traversal
- Backward compatibility wrappers with deprecation warnings

## Critical Invariants
- Module names must not start with '.' (relative imports unsupported)
- Path parameters must be lists, not strings
- Deduplication prevents infinite recursion in circular package structures
- FileFinder registration happens at module load time (L170-171)