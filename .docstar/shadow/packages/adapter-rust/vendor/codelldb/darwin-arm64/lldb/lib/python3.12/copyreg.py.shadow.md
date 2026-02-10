# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/copyreg.py
@source-hash: c8eda41f05c6bf95
@generated: 2026-02-09T18:07:06Z

## Purpose
Core Python pickle extension registry module that provides infrastructure for adding pickling support to C extension types and managing extension codes for object serialization. Part of Python's standard library pickling mechanism.

## Key Components

### Core Registration System
- **dispatch_table** (L10): Global dictionary mapping object types to their pickle functions
- **pickle()** (L12-20): Registers reduction functions for object types in dispatch_table
- **constructor()** (L22-24): Validates constructor callability (legacy function, minimal functionality)

### Built-in Type Support
- **pickle_complex()** (L28-29): Reduction function for complex numbers, returns (complex, (real, imag))
- **pickle_union()** (L33-35): Handles Union type pickling using functools.reduce and operator.or_
- Default registrations for complex (L31) and Union types (L37)

### Object Reconstruction Infrastructure
- **_reconstructor()** (L41-48): Core function for rebuilding objects during unpickling
- **_reduce_ex()** (L55-94): Implementation of object.__reduce_ex__ for protocols 0-1, handles class hierarchy traversal and state extraction
- **__newobj__()** (L98-99): Helper for protocol 2+ object creation
- **__newobj_ex__()** (L101-105): Protocol 4 variant supporting keyword arguments

### Slot Handling
- **_slotnames()** (L107-156): Extracts and caches slot names from class MRO, handles name mangling and special descriptors

### Extension Code Registry
- **_extension_registry** (L167): Maps (module, name) -> code
- **_inverted_registry** (L168): Maps code -> (module, name) 
- **_extension_cache** (L169): Caches code -> object mappings
- **add_extension()** (L173-189): Registers extension codes with validation
- **remove_extension()** (L191-201): Unregisters extension codes
- **clear_extension_cache()** (L203-204): Clears extension cache

## Architecture Notes
- Uses global registries for type-to-function mappings and extension codes
- Supports multiple pickle protocols (0, 1, 2, 4+) with protocol-specific helpers
- Implements caching for slot names to optimize repeated lookups
- Extension codes provide universal compression mechanism for global references

## Critical Constraints
- Extension codes must be in range 1-0x7fffffff
- No duplicate registrations allowed in extension registry
- Classes with __slots__ require __getstate__ for protocols 0-1
- Heap types identified by _HEAPTYPE flag (1<<9)