# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/zipimport.py
@source-hash: a96f1d7a7b6aaf42
@generated: 2026-02-09T18:07:41Z

## Purpose
Python's `zipimport` module provides support for importing Python modules from Zip archives. This module is part of Python's import machinery and is typically invoked automatically when `sys.path` contains paths to Zip files.

## Core Components

### ZipImportError Exception (L34-35)
Custom exception class that inherits from `ImportError`, raised when zip import operations fail.

### zipimporter Class (L46-275)
Main importer class that implements the import protocol for Zip archives. Inherits from `_bootstrap_external._LoaderBasics`.

**Key Methods:**
- `__init__(self, path)` (L64-102): Validates archive path, splits into archive + prefix components, loads directory cache
- `find_spec(self, fullname, target=None)` (L104-130): Creates ModuleSpec for modules, handles namespace packages
- `get_code(self, fullname)` (L131-138): Returns compiled code object for module
- `get_data(self, pathname)` (L141-158): Extracts raw file data from archive
- `get_source(self, fullname)` (L174-196): Returns source code as string or None
- `is_package(self, fullname)` (L200-209): Determines if module is a package
- `load_module(self, fullname)` (L213-253): **DEPRECATED** - loads and executes module
- `get_resource_reader(self, fullname)` (L256-260): Returns ResourceReader for importlib.resources
- `invalidate_caches(self)` (L263-270): Refreshes directory cache

## Module-level Functions

### Directory Reading (L335-458)
- `_read_directory(archive)`: Parses ZIP central directory, returns file mapping dict
- Handles ZIP format complexities: comments, DOS timestamps, filename encodings

### Module Resolution (L291-311)
- `_get_module_path(self, fullname)` (L291-292): Converts module name to archive path
- `_is_dir(self, path)` (L295-301): Checks if path represents directory
- `_get_module_info(self, fullname)` (L304-310): Returns package status or None

### Code Processing (L575-712)
- `_unmarshal_code()` (L575-613): Validates and unmarshals .pyc files with timestamp/hash checking
- `_compile_source(pathname, source)` (L627-629): Compiles Python source to code object
- `_get_module_code(self, fullname)` (L680-712): Main module loading logic following search order

### Data Extraction (L521-561)
- `_get_data(archive, toc_entry)`: Reads and optionally decompresses file data from ZIP
- `_get_decompress_func()` (L500-518): Lazy zlib import with recursion protection

### Utility Functions
- `_parse_dostime(d, t)` (L633-641): Converts DOS timestamp to Unix time
- `_get_mtime_and_size_of_source()` (L646-659): Gets source file metadata
- `_normalize_line_endings(source)` (L620-623): Standardizes line endings

## Key Data Structures

### Module Cache (L38)
- `_zip_directory_cache`: Global dict mapping archive paths to directory info

### Search Strategy (L282-287)
- `_zip_searchorder`: Defines module search priority: `__init__.pyc`, `__init__.py`, `.pyc`, `.py`

### ZIP Constants (L42-44)
- End-of-central-directory signature and size constants

### CP437 Translation Table (L466-493)
Hardcoded character translation table for legacy ZIP filename encoding, avoiding circular import during bootstrap.

## Architecture Notes

- **Caching Strategy**: Directory contents cached globally to avoid repeated ZIP parsing
- **Import Protocol**: Implements modern importlib finder/loader interface
- **Bootstrap Compatibility**: Uses `_frozen_importlib*` modules to avoid import cycles
- **Error Handling**: Comprehensive ZIP format validation with specific error messages
- **Encoding Handling**: Supports both UTF-8 and legacy CP437 ZIP filename encodings
- **Compression**: Supports uncompressed and zlib-compressed files