# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/_compat_pickle.py
@source-hash: 12c8356a3d40bd0a
@generated: 2026-02-09T18:08:26Z

## Purpose and Responsibility
Provides Python 2 to Python 3 name mapping for pickle module compatibility. Enables pickle streams generated with Python 2 to be loaded by Python 3 by mapping old module/attribute names to their new Python 3 equivalents.

## Key Data Structures

**IMPORT_MAPPING (L8-51)**: Dictionary mapping Python 2 module names to Python 3 module names. Covers major module reorganizations like `__builtin__` → `builtins`, `Queue` → `queue`, various tkinter modules, HTTP libraries, and database modules.

**NAME_MAPPING (L57-91)**: Dictionary mapping tuples of (module, attribute) from Python 2 to Python 3. Handles renamed functions/classes within modules, such as:
- Built-in function renames: `xrange` → `range`, `unicode` → `str`
- Iterator function moves: `itertools.izip` → `builtins.zip`
- Library reorganizations: `urllib` function relocations

**PYTHON2_EXCEPTIONS (L93-142)**: Tuple containing all Python 2 exception names that need mapping from `exceptions` module to `builtins` module.

**Reverse Mappings (L165-168)**: `REVERSE_IMPORT_MAPPING` and `REVERSE_NAME_MAPPING` provide bidirectional compatibility for 3.x to 2.x conversion.

## Dynamic Exception Mapping

**Windows Exception Handling (L144-149)**: Conditionally adds `WindowsError` to exception mappings if available on the platform.

**Exception Registration Loops (L151-152, L161-162, L243-244, L250-251)**: Programmatically populates NAME_MAPPING with exception mappings for:
- Standard Python 2 exceptions → builtins
- Multiprocessing exceptions → multiprocessing.context
- Python 3 OSError subclasses → exceptions.OSError (reverse)
- Python 3 ImportError subclasses → exceptions.ImportError (reverse)

## Non-Mutual Extensions

**Additional Import Mappings (L172-187)**: Extends IMPORT_MAPPING with one-way mappings for modules like `cPickle` → `pickle`, I/O modules, and compatibility fixes for broken pickles from old Python 3 versions.

**Additional Reverse Mappings (L189-224)**: Extends reverse mappings for private modules and specific class/function relocations.

## Architecture Notes

- Avoids importing lib2to3 to prevent circular dependencies since lib2to3 uses pickle
- Uses tuple keys in NAME_MAPPING for (module, name) pairs to handle attribute-level mappings
- Maintains bidirectional compatibility with assertion checks ensuring mapping integrity
- Handles platform-specific exceptions dynamically
- Separates mutual mappings from one-way compatibility fixes