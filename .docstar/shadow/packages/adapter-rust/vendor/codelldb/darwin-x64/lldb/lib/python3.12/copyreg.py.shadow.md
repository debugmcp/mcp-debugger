# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/copyreg.py
@source-hash: c8eda41f05c6bf95
@generated: 2026-02-09T18:09:23Z

## Purpose
Python's `copyreg` module provides extensibility infrastructure for the pickle serialization protocol. It enables registration of custom pickle functions for extension types (particularly C extensions) and manages extension codes for efficient serialization.

## Key Components

### Core Registration Functions
- `pickle(ob_type, pickle_function, constructor_ob=None)` (L12-20): Registers a custom pickling function for a specific type in the global `dispatch_table`
- `constructor(object)` (L22-24): Validates that constructor functions are callable (legacy safety mechanism)

### Built-in Type Support
- `pickle_complex(c)` (L28-29): Default pickle support for complex numbers
- `pickle_union(obj)` (L33-35): Pickle support for union types (e.g., `int | str`)
- Automatic registration for `complex` (L31) and union types (L37)

### Object Reconstruction Infrastructure
- `_reconstructor(cls, base, state)` (L41-48): Core function for rebuilding objects during unpickling, handles inheritance hierarchy
- `_reduce_ex(self, proto)` (L55-94): Implementation of `__reduce_ex__` for protocols 0 and 1, finds appropriate base class and handles state extraction
- `__newobj__(cls, *args)` (L98-99): Helper for protocol 2 object reconstruction
- `__newobj_ex__(cls, args, kwargs)` (L101-105): Protocol 4 variant supporting keyword arguments

### Slot Handling
- `_slotnames(cls)` (L107-156): Discovers and caches all slot names from a class hierarchy, handles name mangling and special descriptors

### Extension Code Registry
- `_extension_registry` (L167): Maps (module, name) tuples to integer codes
- `_inverted_registry` (L168): Maps codes back to (module, name) tuples  
- `_extension_cache` (L169): Runtime cache for resolved objects
- `add_extension(module, name, code)` (L173-189): Registers extension codes with validation
- `remove_extension(module, name, code)` (L191-201): Unregisters extension codes
- `clear_extension_cache()` (L203-204): Clears the runtime cache

## Key Constants
- `_HEAPTYPE` (L50): Flag constant (1<<9) for identifying heap-allocated types
- `_new_type` (L51): Type reference for `__new__` method detection

## Architecture Notes
- Global `dispatch_table` (L10) serves as the main registry for custom pickle functions
- Extension code system provides universal compression mechanism for common global references
- Code ranges 1-127 reserved for Python stdlib, 128-255 for external use
- Immutable registries warning (L170-171): pickle module captures references at initialization

## Dependencies
- Standard library: `functools`, `operator` (imported dynamically in `pickle_union`)
- Core Python object model: `__new__`, `__init__`, `__getstate__`, `__slots__`, `__mro__`