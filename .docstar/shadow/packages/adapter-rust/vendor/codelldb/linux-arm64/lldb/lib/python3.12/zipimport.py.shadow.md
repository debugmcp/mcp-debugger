# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/zipimport.py
@source-hash: a96f1d7a7b6aaf42
@generated: 2026-02-09T18:10:34Z

# zipimport.py - ZIP Archive Python Module Importer

Core implementation of Python's zipimport module, providing support for importing Python modules from ZIP archives. Part of Python's built-in import mechanism for sys.path items that are ZIP archive paths.

## Key Classes

**ZipImportError (L34-35)**: Exception class for ZIP import failures, inherits from ImportError.

**zipimporter (L46-274)**: Main ZIP importer class implementing Python's import protocol.
- Inherits from `_bootstrap_external._LoaderBasics`
- Manages ZIP archive file directory caching via `_zip_directory_cache`
- Key attributes: `archive` (ZIP file path), `prefix` (subdirectory), `_files` (directory mapping)

### zipimporter Core Methods
- `__init__(path)` (L64-102): Validates ZIP path, parses subdirectories, caches file directory
- `find_spec(fullname, target=None)` (L104-129): Creates ModuleSpec for importable modules/packages
- `get_code(fullname)` (L131-138): Returns compiled code object for module
- `get_data(pathname)` (L141-158): Retrieves raw file data from archive
- `get_filename(fullname)` (L162-171): Returns module filename path
- `get_source(fullname)` (L174-196): Returns source code string or None
- `is_package(fullname)` (L200-209): Determines if module is a package
- `load_module(fullname)` (L213-253): **DEPRECATED** - loads and executes module (warns about deprecation)
- `get_resource_reader(fullname)` (L256-260): Returns ZipReader for resource access
- `invalidate_caches()` (L263-270): Refreshes cached directory information

## Module Search and Resolution

**_zip_searchorder** (L282-287): Defines module search priority: `__init__.pyc`, `__init__.py`, `.pyc`, `.py`

**Helper Functions:**
- `_get_module_path(self, fullname)` (L291-292): Constructs file path from module name
- `_is_dir(self, path)` (L295-301): Checks if path represents directory in archive
- `_get_module_info(self, fullname)` (L304-310): Returns package status or None if not found
- `_get_module_code(self, fullname)` (L680-712): Core module loading logic with fallback handling

## ZIP Archive Processing

**_read_directory(archive)** (L335-458): Parses ZIP central directory structure
- Handles ZIP file format parsing including central directory records
- Creates file mapping: filename → (path, compress, data_size, file_size, file_offset, time, date, crc)
- Supports both ASCII and UTF-8 filename encodings
- Includes fallback CP437 character translation table (L466-493)

**_get_data(archive, toc_entry)** (L521-561): Extracts and decompresses file data
- Validates local file headers
- Handles both compressed (zlib) and uncompressed data
- Uses `_get_decompress_func()` (L500-518) for zlib decompression with import cycle protection

## Bytecode Handling

**_unmarshal_code()** (L575-613): Validates and unmarshals bytecode files
- Supports both timestamp-based and hash-based .pyc validation
- Uses `_eq_mtime()` (L567-569) for lenient timestamp comparison
- Integrates with `_get_mtime_and_size_of_source()` (L646-659) and `_get_pyc_source()` (L665-675)

**Source Processing:**
- `_compile_source(pathname, source)` (L627-629): Compiles Python source to bytecode
- `_normalize_line_endings(source)` (L620-623): Standardizes line endings
- `_parse_dostime(d, t)` (L633-641): Converts DOS timestamps to Unix format

## Global State

- `_zip_directory_cache` (L38): Global cache mapping archive paths to directory info
- `_importing_zlib` (L495): Flag preventing zlib import cycles
- Path manipulation constants: `path_sep`, `alt_path_sep` (L30-31)
- ZIP format constants: `END_CENTRAL_DIR_SIZE`, `STRING_END_ARCHIVE`, `MAX_COMMENT_LEN` (L42-44)

## Dependencies
- `_frozen_importlib_external` and `_frozen_importlib` for bootstrap integration
- `marshal` for bytecode deserialization  
- `_imp` for hash-based pyc validation
- `zlib` for compressed data (lazy-loaded)
- `importlib.readers.ZipReader` for resource reading