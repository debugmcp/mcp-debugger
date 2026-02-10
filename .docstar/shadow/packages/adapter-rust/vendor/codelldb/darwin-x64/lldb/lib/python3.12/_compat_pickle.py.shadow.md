# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/_compat_pickle.py
@source-hash: 12c8356a3d40bd0a
@generated: 2026-02-09T18:07:31Z

## Purpose
Python 2/3 compatibility module for pickle deserialization. Maps old Python 2 module/function names to their Python 3 equivalents to enable loading pickle streams generated with Python 2 in Python 3 environments.

## Core Data Structures

**IMPORT_MAPPING (L8-51)**: Dict mapping Python 2 module names to Python 3 equivalents. Covers major reorganizations like `__builtin__` → `builtins`, `Queue` → `queue`, tkinter modules, urllib reorganization, and database modules.

**NAME_MAPPING (L57-91)**: Dict mapping (module, name) tuples from Python 2 to Python 3. Handles function/class renames within modules, including:
- Built-in function changes (`xrange` → `range`, `unicode` → `str`)
- Iterator module consolidations (`izip` → `zip`)
- urllib function relocations across submodules

**PYTHON2_EXCEPTIONS (L93-142)**: Tuple of exception names that existed in Python 2's `exceptions` module, now moved to `builtins` in Python 3.

**MULTIPROCESSING_EXCEPTIONS (L154-159)**: Tuple of multiprocessing exceptions moved from root module to `multiprocessing.context`.

## Reverse Mappings

**REVERSE_IMPORT_MAPPING (L165)** and **REVERSE_NAME_MAPPING (L167)**: Auto-generated inverse mappings for bidirectional compatibility.

## Dynamic Population

- Lines 151-152: Dynamically adds all Python 2 exceptions to NAME_MAPPING
- Lines 161-162: Adds multiprocessing exceptions to NAME_MAPPING  
- Lines 243-244: Maps Python 3 OSError subclasses back to generic OSError for reverse compatibility
- Lines 250-251: Maps ModuleNotFoundError back to ImportError

## Non-Mutual Mappings

**Additional IMPORT_MAPPING entries (L172-187)**: One-way mappings including `cPickle` → `pickle`, StringIO consolidation, and compatibility fixes for broken old Python 3 pickles.

**Additional REVERSE mappings (L189-224)**: Complex reverse mappings for internal modules and specific class relocations.

## Architecture Notes

- Avoids lib2to3 dependency to prevent circular imports since lib2to3 uses pickle
- Uses assertion checks to verify bijective mapping integrity where expected
- Handles platform-specific exceptions (WindowsError detection L144-149)
- Supports both forward (Py2→Py3) and reverse (Py3→Py2) compatibility