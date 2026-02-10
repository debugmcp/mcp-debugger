# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/zipimport.py
@source-hash: a96f1d7a7b6aaf42
@generated: 2026-02-09T18:14:22Z

**Purpose**: Python zipimport module providing support for importing Python modules from ZIP archives. This is a core import mechanism that extends Python's module loading to handle ZIP-based distribution and packaging.

**Core Components**:

- **ZipImportError** (L34-35): Custom exception class inheriting from ImportError for ZIP-specific import failures
- **zipimporter** (L46-275): Main importer class implementing the importlib protocol for loading modules from ZIP archives
- **_zip_directory_cache** (L38): Global dict caching ZIP directory contents to avoid repeated archive parsing

**zipimporter Class Key Methods**:
- `__init__` (L64-102): Validates archive path, handles subdirectories within ZIP, caches directory contents
- `find_spec` (L104-129): Creates ModuleSpec for modules, handles namespace packages
- `get_code` (L131-138): Returns compiled code object for a module
- `get_data` (L141-158): Retrieves raw file data from ZIP archive
- `get_source` (L174-196): Returns source code string for modules
- `load_module` (L213-253): Legacy module loading (deprecated in favor of exec_module)
- `invalidate_caches` (L263-270): Refreshes cached ZIP directory contents

**Archive Processing Functions**:
- **_read_directory** (L335-458): Core ZIP parsing logic, reads central directory, handles file entries with compression info
- **_get_data** (L521-561): Extracts and decompresses file data from ZIP using zlib when needed
- **_unmarshal_code** (L575-613): Unmarshals bytecode files (.pyc), validates timestamps and hashes
- **_get_module_code** (L680-712): Main module resolution logic, tries different file extensions in priority order

**Search and Resolution**:
- **_zip_searchorder** (L282-287): Defines module search priority: __init__.pyc, __init__.py, .pyc, .py
- **_get_module_info** (L304-310): Determines if module exists and whether it's a package
- **_get_module_path** (L291-292): Constructs module file path within archive

**Dependencies**: Relies heavily on _frozen_importlib_external and _frozen_importlib for import protocol integration, uses marshal for bytecode handling, zlib for decompression.

**Key Constants**: END_CENTRAL_DIR_SIZE (L42), STRING_END_ARCHIVE (L43) for ZIP format parsing, cp437_table (L466-493) for filename encoding conversion.

**Architecture Notes**: Implements lazy loading with directory caching, supports both source and bytecode modules, handles compressed and uncompressed files, integrates with Python's import machinery through finder/loader protocol.