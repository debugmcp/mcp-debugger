# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/_compat_pickle.py
@source-hash: 12c8356a3d40bd0a
@generated: 2026-02-09T18:12:44Z

## Purpose
Python 2/3 compatibility module for pickle deserialization. Provides mapping tables to translate module and object names between Python 2 and Python 3 namespaces, enabling cross-version pickle compatibility.

## Key Data Structures

### IMPORT_MAPPING (L8-51)
Dictionary mapping Python 2 module names to Python 3 equivalents. Essential for translating module imports during pickle loading. Covers major standard library reorganizations:
- `__builtin__` → `builtins`
- `Queue` → `queue` 
- Tkinter modules → `tkinter.*` submodules
- HTTP/URL modules → `http.*`/`urllib.*` submodules
- Database modules → `dbm.*` submodules

### NAME_MAPPING (L57-91)
Dictionary mapping (module, name) tuples from Python 2 to Python 3. Handles specific function/class renames within modules:
- Built-in function changes: `xrange` → `range`, `unicode` → `str`
- Iterator functions: `itertools.izip` → `builtins.zip`
- Collection classes moved to `collections` module
- URL parsing functions reorganized in `urllib` submodules

### Exception Mappings (L93-162)
- **PYTHON2_EXCEPTIONS** (L93-142): Tuple of standard exception names
- **MULTIPROCESSING_EXCEPTIONS** (L154-159): Multiprocessing-specific exceptions
- Dynamic mapping generation (L151-152, L161-162) adds exception mappings to NAME_MAPPING

### Reverse Mappings (L164-168)
- **REVERSE_IMPORT_MAPPING**: Python 3 → Python 2 module mapping
- **REVERSE_NAME_MAPPING**: Python 3 → Python 2 name mapping
- Assertions verify bidirectional mapping integrity

## Extended Mappings (L172-251)

### Non-mutual Import Updates (L172-187)
Additional one-way mappings for special cases like `cPickle` → `pickle`, legacy Tkinter dialogs.

### Reverse-only Mappings (L189-224)
Handles cases where Python 3 internal modules map back to Python 2 public APIs.

### Python 3 Exception Hierarchy (L226-251)
Maps Python 3's refined OSError and ImportError subclasses back to their Python 2 base exceptions for reverse compatibility.

## Architecture Notes
- Avoids lib2to3 dependency to prevent circular imports (L5-6)
- Uses tuple-based keys for (module, name) mappings to handle intra-module renames
- Maintains bidirectional compatibility through reverse mappings
- Dynamically generates exception mappings to reduce code duplication
- Handles platform-specific exceptions (WindowsError check L144-149)