# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/copyreg.py
@source-hash: c8eda41f05c6bf95
@generated: 2026-02-09T18:09:41Z

## copyreg.py - Pickle Extension Registration System

**Primary Purpose**: Provides extensibility for Python's pickle module, enabling custom pickling support for C extension types and managing pickle reduction functions.

### Core Components

**Global Registry (L10, L167-169)**
- `dispatch_table` (L10): Maps object types to their pickle reduction functions
- `_extension_registry` (L167): Maps (module, name) keys to extension codes
- `_inverted_registry` (L168): Maps extension codes back to keys  
- `_extension_cache` (L169): Caches extension objects by code

**Main Registration Functions**
- `pickle(ob_type, pickle_function, constructor_ob=None)` (L12-20): Registers a reduction function for a given type in dispatch_table
- `constructor(object)` (L22-24): Validates constructor callability (legacy vestige function)

**Built-in Type Support**
- `pickle_complex(c)` (L28-29): Reduction function for complex numbers
- `pickle_union(obj)` (L33-35): Reduction function for union types (int | str style)
- Pre-registered at L31 and L37

**Object Reconstruction System**
- `_reconstructor(cls, base, state)` (L41-48): Core object reconstruction function handling inheritance chains
- `_reduce_ex(self, proto)` (L55-94): Protocol 0/1 reduction implementation with slots/state handling
- `__newobj__(cls, *args)` (L98-99): Protocol 2+ object creation helper
- `__newobj_ex__(cls, args, kwargs)` (L101-105): Protocol 4+ creation with keyword args

**Slot Name Resolution**
- `_slotnames(cls)` (L107-156): Traverses MRO to collect all slot names, handles name mangling and caching

**Extension Code Management**
- `add_extension(module, name, code)` (L173-189): Registers extension codes with validation
- `remove_extension(module, name, code)` (L191-201): Unregisters extension codes
- `clear_extension_cache()` (L203-204): Clears extension object cache

### Key Constants
- `_HEAPTYPE = 1<<9` (L50): Flag for heap-allocated types
- `_new_type` (L51): Type of built-in __new__ methods

### Architectural Patterns
- Dual registry system (forward/inverse mapping) for extension codes
- Caching mechanism for slot names and extension objects
- Protocol-aware reduction with fallback chains
- MRO traversal for comprehensive slot collection
- Validation of code ranges (1 to 0x7fffffff)

### Critical Constraints
- Extension codes must be in range 1-0x7fffffff
- Constructor and pickle functions must be callable
- Slots classes without __getstate__ cannot be pickled with protocol < 2
- Registry consistency maintained between forward and inverse mappings