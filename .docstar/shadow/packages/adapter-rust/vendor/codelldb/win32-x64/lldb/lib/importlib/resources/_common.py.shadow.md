# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/importlib/resources/_common.py
@source-hash: 9bfef8de14579936
@generated: 2026-02-09T18:06:15Z

## Purpose
Core utilities for Python's importlib.resources system, providing resource access and traversal functionality for packages. Handles resource discovery, temporary file/directory creation, and backward compatibility for parameter naming.

## Key Functions

### Resource Access & Discovery
- **`files(anchor)` (L52-56)**: Main entry point for getting Traversable resources from packages/modules, decorated with backward compatibility wrapper
- **`get_resource_reader(package)` (L59-72)**: Extracts ResourceReader from package's loader spec, with workaround for zipimport weak reference issues
- **`from_package(package)` (L107-114)**: Creates Traversable object from module using wrapped spec and resource reader

### Module Resolution (Single Dispatch)
- **`resolve(cand)` (L75-87)**: Multi-method dispatcher for resolving different anchor types to modules:
  - Default: casts to ModuleType (L77)
  - String: imports via importlib (L81-82) 
  - None: infers caller's module (L85-87)
- **`_infer_caller()` (L90-104)**: Stack inspection to find first caller frame outside this module, filtering out wrapper functions

### Temporary File System Operations
- **`as_file(path)` (L161-176)**: Single dispatch context manager for accessing Traversable as local filesystem path:
  - Generic: creates temp file/dir based on type (L167)
  - pathlib.Path: passthrough (L170-176)
- **`_tempfile(reader, suffix)` (L117-142)**: Low-level temp file creation with proper cleanup, avoiding NamedTemporaryFile for Windows compatibility
- **`_temp_file(path)` (L144-145)**: Convenience wrapper for single file temp creation
- **`_temp_dir(path)` (L188-196)**: Creates temporary directory and replicates entire tree structure
- **`_write_contents(target, source)` (L199-207)**: Recursive function to copy Traversable contents to filesystem

### Utility Functions  
- **`package_to_anchor(func)` (L21-48)**: Decorator for backward compatibility, warns about 'package' → 'anchor' parameter rename
- **`_is_present_dir(path)` (L148-158)**: Safe directory existence check that handles FileNotFoundError exceptions
- **`_temp_path(dir)` (L179-185)**: Wrapper to convert TemporaryDirectory to pathlib.Path

## Type Definitions
- **`Package` (L17)**: Union of ModuleType or string
- **`Anchor` (L18)**: Alias for Package type

## Dependencies
- Core: `os`, `pathlib`, `tempfile`, `functools`, `contextlib`, `types`, `importlib`, `inspect`
- Local: `.abc` (ResourceReader, Traversable), `._adapters` (wrap_spec)

## Architectural Patterns
- Heavy use of single dispatch for type-specific behavior
- Context managers for resource cleanup and temporary file handling  
- Stack introspection for automatic module inference
- Decorator pattern for backward compatibility warnings