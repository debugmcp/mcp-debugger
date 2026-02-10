# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/zipimport.py
@source-hash: a96f1d7a7b6aaf42
@generated: 2026-02-09T18:08:29Z

## zipimport.py - ZIP Archive Python Module Importer

**Core Purpose**: Implements Python's zipimporter mechanism for importing Python modules directly from ZIP archives, supporting both regular modules and namespace packages.

### Key Classes & Components

**zipimporter (L46-275)** - Main importer class inheriting from `_bootstrap_external._LoaderBasics`
- `__init__(L64-102)` - Validates ZIP path, caches directory contents, handles path prefixes
- `find_spec(L104-129)` - Creates ModuleSpec for importable modules or namespace packages  
- `get_code(L131-138)` - Returns compiled code object for module
- `get_data(L141-158)` - Extracts raw data from ZIP archive entries
- `get_filename(L162-171)` - Returns module filename within archive
- `get_source(L174-196)` - Returns Python source code if available
- `is_package(L200-209)` - Determines if module is a package
- `load_module(L213-253)` - Legacy module loading (deprecated in 3.10, removal in 3.12)
- `get_resource_reader(L256-260)` - Returns ZipReader for resource access
- `invalidate_caches(L263-270)` - Refreshes cached ZIP directory data

**ZipImportError (L34-35)** - Exception class for ZIP import failures, extends ImportError

### Core Functions

**_read_directory(L335-458)** - ZIP archive parser that builds file directory cache
- Handles ZIP64 format, central directory parsing, filename encoding (UTF-8/ASCII/latin1)
- Returns dict mapping filenames to toc_entry tuples with metadata

**_get_module_code(L680-712)** - Module code resolution using search order priority
- Searches for `__init__.pyc`, `__init__.py`, `.pyc`, `.py` files in order
- Handles bytecode validation and source compilation

**_unmarshal_code(L575-613)** - Bytecode validation and unmarshalling
- Supports hash-based and timestamp-based .pyc validation
- Performs source freshness checks for bytecode files

**Helper Functions**:
- `_get_module_info(L304-310)` - Module type detection (package vs module)
- `_get_module_path(L291-292)` - Constructs module path within archive
- `_get_data(L521-561)` - ZIP data extraction with zlib decompression support
- `_is_dir(L295-301)` - Directory existence check for namespace packages

### Key Data Structures

**_zip_directory_cache (L38)** - Global cache mapping archive paths to directory contents

**_zip_searchorder (L282-287)** - Module search priority tuple:
```python
(path_sep + '__init__.pyc', True, True),   # Package bytecode
(path_sep + '__init__.py', False, True),   # Package source  
('.pyc', True, False),                     # Module bytecode
('.py', False, False)                      # Module source
```

**toc_entry format (L320-331)** - ZIP file metadata tuple:
`(filepath, compress, data_size, file_size, file_offset, time, date, crc)`

### Architecture Notes

- Integrates with Python's import machinery via sys.path_importer_cache
- Supports namespace packages through directory detection
- Implements lazy loading with directory caching for performance
- Handles multiple filename encodings for cross-platform ZIP compatibility
- Uses DOS time format conversion for .pyc timestamp validation
- Includes zlib import guard to prevent recursive import issues (L495-518)

### Dependencies

- `_frozen_importlib_external` - Core import machinery
- `_frozen_importlib` - Module spec creation and verbose messaging  
- `marshal` - Bytecode unmarshalling
- `zlib` - Archive decompression (lazy imported)
- `_io` - File operations with `open_code()`