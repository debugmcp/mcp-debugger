# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/importlib/_bootstrap_external.py
@source-hash: 949e115a77dd6b25
@generated: 2026-02-09T18:11:36Z

## Core purpose

Bootstrap implementation of path-based Python import system. This module provides the low-level infrastructure for finding and loading modules from the filesystem. Not intended for direct import - designed to be bootstrapped into Python's import machinery.

## Key components

### Platform handling (L33-51)
- `_MS_WINDOWS` (L33): Platform detection constant
- `path_separators` (L42-50): OS-specific path separator handling
- Path separator constants: `path_sep`, `path_sep_tuple`, `path_separators`, `_pathseps_with_colon`

### Case sensitivity support (L54-76)
- `_CASE_INSENSITIVE_PLATFORMS*` (L54-57): Platform tuples for case-insensitive filesystems
- `_make_relax_case()` (L60-74): Factory function creating case sensitivity checker
- `_relax_case` (L76): Function determining if case-insensitive filename matching should be used

### Binary data utilities (L79-93)
- `_pack_uint32()` (L79-81): Convert 32-bit integer to little-endian bytes
- `_unpack_uint32()` (L84-87): Convert 4 bytes to integer
- `_unpack_uint16()` (L89-92): Convert 2 bytes to integer

### Path manipulation utilities (L95-193)
- `_path_join()` (L96-129): OS-specific path joining with Windows drive handling
- `_path_split()` (L132-137): Split path into directory and filename
- `_path_stat()` (L140-147): File stat wrapper
- `_path_is_mode_type()` (L150-156): Check file mode type
- `_path_isfile()` (L159-161): Check if path is regular file
- `_path_isdir()` (L164-168): Check if path is directory
- `_path_isabs()` (L172-182): Check if path is absolute
- `_path_abspath()` (L185-192): Convert to absolute path

### Atomic file operations (L195-217)
- `_write_atomic()` (L195-214): Atomic file writing using temporary files

### Bytecode constants and utilities (L222-481)
- `MAGIC_NUMBER` (L465): Bytecode compatibility magic number (3531)
- `SOURCE_SUFFIXES` (L472): Python source file extensions
- `EXTENSION_SUFFIXES` (L476): C extension file suffixes
- `BYTECODE_SUFFIXES` (L478): Compiled bytecode file extensions

### Cache path management (L482-589)
- `cache_from_source()` (L482-549): Convert .py path to .pyc path with __pycache__ handling
- `source_from_cache()` (L552-589): Convert .pyc path back to .py path
- `_get_sourcefile()` (L592-608): Legacy bytecode-to-source conversion
- `_get_cached()` (L611-620): Get cached bytecode path for source file

### Bytecode validation (L635-783)
- `_check_name()` (L635-663): Decorator ensuring loader name matches module
- `_classify_pyc()` (L666-696): Basic .pyc header validation
- `_validate_timestamp_pyc()` (L699-724): Timestamp-based bytecode validation
- `_validate_hash_pyc()` (L727-748): Hash-based bytecode validation
- `_compile_bytecode()` (L751-761): Compile bytecode from .pyc data
- `_code_to_timestamp_pyc()` (L764-771): Generate timestamp-based .pyc data
- `_code_to_hash_pyc()` (L774-782): Generate hash-based .pyc data

### Source code handling (L785-794)
- `decode_source()` (L785-794): Decode source bytes to string with encoding detection

### Module specification (L802-869)
- `spec_from_file_location()` (L802-869): Create ModuleSpec from file path

### Loader helper (L872-917)
- `_bless_my_loader()` (L872-917): Helper for warnings system to resolve module loaders

## Core loader classes

### `WindowsRegistryFinder` (L922-970)
Meta path finder for Windows registry-declared modules. Searches Windows registry for module paths.

### `_LoaderBasics` (L973-1000)
Base class providing common loader functionality:
- `is_package()` (L978-984): Package detection via __init__ files
- `create_module()` (L986-987): Default module creation
- `exec_module()` (L989-995): Module execution
- `load_module()` (L997-1000): Deprecated loading method

### `SourceLoader` (L1003-1145)
Abstract base for source-based loaders:
- `path_mtime()` (L1005-1011): Get source modification time
- `path_stats()` (L1013-1025): Get source metadata
- `get_source()` (L1044-1052): Read and decode source
- `source_to_code()` (L1054-1060): Compile source to code object
- `get_code()` (L1062-1145): Complex bytecode/source loading with caching logic

### `FileLoader` (L1148-1196)
Base file system loader:
- Constructor stores name and path (L1153-1157)
- `get_filename()` (L1178-1181): Return file path
- `get_data()` (L1183-1190): Read file data with special handling for source/extension loaders

### `SourceFileLoader` (L1198-1241)
Concrete source file loader:
- `path_stats()` (L1202-1205): File system stat implementation
- `set_data()` (L1212-1240): Write bytecode with directory creation

### `SourcelessFileLoader` (L1243-1266)
Loader for .pyc files without source:
- `get_code()` (L1247-1261): Load and validate bytecode
- `get_source()` (L1263-1265): Returns None (no source)

### `ExtensionFileLoader` (L1268-1318)
Loader for C extension modules:
- `create_module()` (L1287-1293): Create extension module
- `exec_module()` (L1295-1299): Initialize extension
- `is_package()` (L1301-1305): Package detection for extensions

### Namespace package support (L1321-1429)
- `_NamespacePath` (L1321-1387): Dynamic path object for namespace packages
- `NamespaceLoader` (L1392-1425): Loader for namespace packages

## Path finding system

### `PathFinder` (L1434-1555)
Meta path finder for sys.path:
- `invalidate_caches()` (L1439-1454): Clear import caches
- `_path_hooks()` (L1457-1467): Search sys.path_hooks for finders
- `_path_importer_cache()` (L1470-1489): Manage finder cache
- `_get_spec()` (L1492-1518): Core module finding logic
- `find_spec()` (L1521-1542): Main entry point for module finding

### `FileFinder` (L1558-1694)
File system-based finder:
- Constructor with loader registration (L1567-1582)
- `find_spec()` (L1593-1642): Find modules in directory
- `_fill_cache()` (L1644-1673): Cache directory contents with case handling
- `path_hook()` (L1676-1691): Create path hook closure

## Import system integration (L1697-1744)
- `_fix_up_module()` (L1699-1721): Fix module attributes during import
- `_get_supported_file_loaders()` (L1724-1732): Get standard loader types
- `_install()` (L1740-1744): Install path-based import system

## Dependencies
- Imports: `_imp`, `_io`, `sys`, `_warnings`, `marshal`
- Conditional: `nt`/`posix` as `_os`, `winreg` (Windows)
- Injected: `_bootstrap` module (set by `_set_bootstrap_module`)

## Architecture notes
- Bootstrap-aware design: Cannot reference injected objects at class level
- Platform abstraction for Windows vs Unix path handling
- Comprehensive bytecode validation and caching system
- Support for both timestamp and hash-based .pyc files
- Case-insensitive filename support for applicable platforms