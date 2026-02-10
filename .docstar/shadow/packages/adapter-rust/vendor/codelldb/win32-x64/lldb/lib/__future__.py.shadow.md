# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/__future__.py
@source-hash: 981d4c398849f9eb
@generated: 2026-02-09T18:12:43Z

## Purpose
Python's `__future__` module implementation that tracks phased-in incompatible language changes. This file defines metadata for Python language features that can be imported via `from __future__ import feature_name` to enable new behavior before it becomes mandatory.

## Key Components

### Feature Registry (L50-63)
- `all_feature_names` (L50-61): List of all available future features including `nested_scopes`, `generators`, `division`, `absolute_import`, `with_statement`, `print_function`, `unicode_literals`, `barry_as_FLUFL`, `generator_stop`, and `annotations`
- `__all__` (L63): Module's public API combining feature names with the list itself

### Compiler Flags (L69-78)
Bitfield constants matching Include/cpython/compile.h definitions:
- `CO_NESTED` (L69): 0x0010 for nested scopes
- `CO_GENERATOR_ALLOWED` (L70): 0 (obsolete)
- `CO_FUTURE_DIVISION` (L71): 0x20000 for true division
- `CO_FUTURE_ABSOLUTE_IMPORT` (L72): 0x40000 for absolute imports
- `CO_FUTURE_WITH_STATEMENT` (L73): 0x80000 for with statements
- `CO_FUTURE_PRINT_FUNCTION` (L74): 0x100000 for print as function
- `CO_FUTURE_UNICODE_LITERALS` (L75): 0x200000 for unicode literals
- `CO_FUTURE_BARRY_AS_BDFL` (L76): 0x400000 for easter egg feature
- `CO_FUTURE_GENERATOR_STOP` (L77): 0x800000 for StopIteration handling
- `CO_FUTURE_ANNOTATIONS` (L78): 0x1000000 for deferred annotations

### _Feature Class (L81-107)
Metadata container for future features:
- `__init__` (L83-86): Stores optional release, mandatory release, and compiler flag
- `getOptionalRelease()` (L88-93): Returns 5-tuple of first supporting release
- `getMandatoryRelease()` (L95-101): Returns 5-tuple of mandatory release or None
- `__repr__` (L103-106): String representation for debugging

### Feature Instances (L109-147)
Module-level `_Feature` instances for each language feature:
- `nested_scopes` (L109-111): Optional in 2.1.0b1, mandatory in 2.2.0a0
- `generators` (L113-115): Optional in 2.2.0a1, mandatory in 2.3.0
- `division` (L117-119): Optional in 2.2.0a2, mandatory in 3.0.0a0
- `absolute_import` (L121-123): Optional in 2.5.0a1, mandatory in 3.0.0a0
- `with_statement` (L125-127): Optional in 2.5.0a1, mandatory in 2.6.0a0
- `print_function` (L129-131): Optional in 2.6.0a2, mandatory in 3.0.0a0
- `unicode_literals` (L133-135): Optional in 2.6.0a2, mandatory in 3.0.0a0
- `barry_as_FLUFL` (L137-139): Optional in 3.1.0a2, mandatory in 4.0.0a0
- `generator_stop` (L141-143): Optional in 3.5.0b1, mandatory in 3.7.0a0
- `annotations` (L145-147): Optional in 3.7.0b1, no mandatory release planned

## Architecture
- Each feature tracks two release versions: when it becomes available via import, and when it becomes default behavior
- Version tuples follow sys.version_info format: (major, minor, micro, level, serial)
- Compiler flags enable features in dynamically compiled code via compile() function
- Features are never removed from this file (L47 invariant)