# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/_compat_pickle.py
@source-hash: 12c8356a3d40bd0a
@generated: 2026-02-09T18:07:02Z

## Purpose
Compatibility module for Python pickle cross-version interoperability. Provides mapping tables to translate Python 2 module/class names to their Python 3 equivalents during unpickling operations. Part of the LLDB debugging environment's Python infrastructure.

## Core Components

### Import Mappings
- **IMPORT_MAPPING (L8-51)**: Dictionary mapping Python 2 module names to Python 3 equivalents (e.g., `'__builtin__': 'builtins'`, `'Queue': 'queue'`)
- **REVERSE_IMPORT_MAPPING (L165)**: Bidirectional mapping from Python 3 back to Python 2 module names
- Additional non-mutual mappings added via `.update()` calls (L172-187, L189-195)

### Name/Class Mappings
- **NAME_MAPPING (L57-91)**: Maps (module, name) tuples between Python versions for specific classes/functions
- **REVERSE_NAME_MAPPING (L167)**: Reverse mapping with additional entries (L204-224)
- Handles complex cases like `('__builtin__', 'xrange') -> ('builtins', 'range')`

### Exception Handling
- **PYTHON2_EXCEPTIONS (L93-142)**: Comprehensive list of Python 2 exception names
- Dynamic mapping generation (L151-152): Maps all exceptions from `'exceptions'` module to `'builtins'`
- **MULTIPROCESSING_EXCEPTIONS (L154-159)**: Special handling for multiprocessing exceptions with dynamic mapping (L161-162)
- **PYTHON3_OSERROR_EXCEPTIONS (L226-241)**: Maps Python 3-specific OSError subclasses back to generic OSError
- **PYTHON3_IMPORTERROR_EXCEPTIONS (L246-248)**: Similar mapping for ImportError subclasses

### Platform-Specific Logic
- **WindowsError handling (L144-149)**: Conditionally adds WindowsError to exception mappings if available on the platform

## Key Features
- Bidirectional mapping support for both 2→3 and 3→2 translation
- Comprehensive coverage of standard library reorganization between Python versions
- Special handling for exception hierarchy changes
- Runtime detection of platform-specific exceptions
- Assertion-verified mapping consistency (L166, L168)

## Dependencies
- No external imports (avoids circular dependency with pickle module)
- Self-contained mapping tables copied from lib2to3.fixes.fix_imports

## Architecture Notes
- Uses tuple-based keys for precise (module, name) mapping
- Employs dynamic mapping generation for systematic exception handling
- Maintains separate forward and reverse mappings for efficiency
- Designed to be imported by pickle internals without circular dependencies