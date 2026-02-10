# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/copyreg.py
@source-hash: c8eda41f05c6bf95
@generated: 2026-02-09T18:08:40Z

## Purpose
Core pickle extension module that provides registration mechanisms for custom object serialization. Part of Python's standard library, enabling C extension types and built-in types to define custom pickling behavior.

## Key Components

### Global Dispatch Registry
- `dispatch_table` (L10): Maps object types to their reduction functions
- Used by pickle module to determine how to serialize custom types

### Core Functions
- `pickle(ob_type, pickle_function, constructor_ob=None)` (L12-20): Registers reduction function for a type in dispatch table. Validates callability and optionally registers constructor
- `constructor(object)` (L22-24): Validates constructor callability (legacy safety mechanism)

### Built-in Type Support
- `pickle_complex(c)` (L28-29): Reduction function for complex numbers, returns constructor and args tuple
- `pickle_union(obj)` (L33-35): Reduction function for union types (int | str), uses functools.reduce with operator.or_
- Auto-registers complex (L31) and union types (L37)

### New-Style Object Pickling
- `_reconstructor(cls, base, state)` (L41-48): Reconstructs objects during unpickling, handles inheritance hierarchy and initialization
- `_reduce_ex(self, proto)` (L55-94): Protocol 0/1 reduction logic, finds appropriate base class and handles state extraction with __slots__ support
- `__newobj__(cls, *args)` (L98-99): Protocol 2+ object constructor helper
- `__newobj_ex__(cls, args, kwargs)` (L101-105): Protocol 4+ constructor supporting keyword arguments

### Slot Name Resolution
- `_slotnames(cls)` (L107-156): Extracts and caches slot names from class hierarchy, handles name mangling and special descriptors

### Extension Registry System
- `_extension_registry` (L167): Maps (module, name) → code
- `_inverted_registry` (L168): Maps code → (module, name) 
- `_extension_cache` (L169): Runtime cache for extension objects
- `add_extension(module, name, code)` (L173-189): Registers extension codes with validation
- `remove_extension(module, name, code)` (L191-201): Unregisters extensions and clears cache
- `clear_extension_cache()` (L203-204): Empties extension cache

## Architecture Notes
- Uses dual registry pattern for bidirectional lookups
- Implements caching strategy for slot names to avoid repeated MRO traversal  
- Extension codes follow standardized ranges (Python stdlib: 1-127, Zope: 128-191, etc.)
- Protocol-aware reduction with backward compatibility support

## Constants
- `_HEAPTYPE = 1<<9` (L50): Heap type flag for type checking
- `_new_type` (L51): Type of new-style constructors for isinstance checks