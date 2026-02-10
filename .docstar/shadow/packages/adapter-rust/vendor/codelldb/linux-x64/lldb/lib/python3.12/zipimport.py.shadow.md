# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/zipimport.py
@source-hash: a96f1d7a7b6aaf42
@generated: 2026-02-09T18:10:24Z

## Purpose
Python zipimport module providing support for importing Python modules from ZIP archives. Implements the zipimporter class that integrates with Python's import mechanism to load modules from compressed archives.

## Core Components

### ZipImportError Exception (L34-35)
Custom exception inheriting from ImportError, raised when ZIP archive operations fail.

### zipimporter Class (L46-275)
Main importer class inheriting from `_bootstrap_external._LoaderBasics`. Implements PEP 302 import protocol for ZIP archives.

**Key Methods:**
- `__init__(path)` (L64-102): Validates ZIP archive path, handles subdirectories, caches directory structure
- `find_spec(fullname, target=None)` (L104-129): Creates ModuleSpec for modules, supports namespace packages
- `get_code(fullname)` (L131-138): Returns compiled code object for module
- `get_data(pathname)` (L141-158): Extracts raw file data from archive
- `get_filename(fullname)` (L162-171): Returns module filename path
- `get_source(fullname)` (L174-196): Returns Python source code if available
- `is_package(fullname)` (L200-209): Determines if module is a package
- `load_module(fullname)` (L213-253): **DEPRECATED** - loads and executes module
- `get_resource_reader(fullname)` (L256-260): Returns ResourceReader for importlib.resources
- `invalidate_caches()` (L263-270): Refreshes cached directory information

## Module Search Logic

### Search Order (L282-287)
Defines priority: `__init__.pyc` → `__init__.py` → `.pyc` → `.py`

### Helper Functions
- `_get_module_path(self, fullname)` (L291-292): Maps module name to archive path
- `_is_dir(self, path)` (L295-301): Checks if path represents directory
- `_get_module_info(self, fullname)` (L304-310): Returns package status for module

## ZIP Archive Processing

### Directory Reading (L335-458)
`_read_directory(archive)` - Core function parsing ZIP central directory:
- Locates end-of-central-directory record (L348-380)
- Parses central directory entries (L400-454)
- Handles UTF-8 and CP437 filename encodings (L440-448)
- Returns files dict mapping names to toc_entry tuples

### Data Extraction (L521-561)
`_get_data(archive, toc_entry)` - Extracts file data:
- Validates local file headers
- Handles compressed/uncompressed data
- Uses zlib for decompression when needed

## Code Compilation & Validation

### Bytecode Handling (L575-613)
`_unmarshal_code()` - Validates and loads .pyc files:
- Checks magic numbers and timestamps
- Supports hash-based .pyc validation
- Compares source modification times

### Source Compilation (L627-629)
`_compile_source(pathname, source)` - Compiles Python source to bytecode

## Global State

### Caching (L38)
`_zip_directory_cache` - Global dict caching parsed ZIP directories by archive path

### Constants (L42-44)
ZIP format constants for end-of-central-directory parsing

### CP437 Translation Table (L466-493)
Pre-computed translation table for legacy ZIP filename encoding

## Dependencies
- `_frozen_importlib_external` - Core importlib functionality
- `_frozen_importlib` - Bootstrap import utilities  
- `marshal` - Python bytecode serialization
- `zlib` - Optional compression support (lazy loaded)
- `_io`, `sys`, `time`, `_warnings` - Standard library utilities

## Architecture Notes
- Integrates with `sys.path_importer_cache` for performance
- Supports both regular and namespace packages
- Thread-safe through immutable cached data structures
- Handles platform path separator differences
- Implements lenient timestamp comparison for DOS time format