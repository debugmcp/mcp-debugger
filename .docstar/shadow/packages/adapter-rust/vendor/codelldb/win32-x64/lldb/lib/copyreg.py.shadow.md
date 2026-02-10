# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/copyreg.py
@source-hash: c8eda41f05c6bf95
@generated: 2026-02-09T18:14:29Z

## Primary Purpose
Core pickle extensibility module that provides registration mechanisms for custom pickling functions, particularly for C extension types. Located in LLDB's bundled Python distribution.

## Key Functions and Components

### Public API Functions (L7-8)
- **`pickle(ob_type, pickle_function, constructor_ob=None)` (L12-20)**: Registers custom pickling function for a type in global `dispatch_table`
- **`constructor(object)` (L22-24)**: Validates constructor callability (legacy vestige function)
- **Extension registry functions**:
  - `add_extension(module, name, code)` (L173-189): Register global extension codes
  - `remove_extension(module, name, code)` (L191-201): Unregister extension codes  
  - `clear_extension_cache()` (L203-204): Clear extension object cache

### Core Pickling Infrastructure
- **`dispatch_table` (L10)**: Global registry mapping types to reduction functions
- **Built-in type support**: Complex numbers (L28-31), union types (L33-37)

### Object Reconstruction System
- **`_reconstructor(cls, base, state)` (L41-48)**: Reconstructs objects during unpickling
- **`_reduce_ex(self, proto)` (L55-94)**: Implements object.__reduce_ex__ for protocols 0-1
- **`__newobj__(cls, *args)` (L98-99)**: Helper for protocol 2+ object reconstruction
- **`__newobj_ex__(cls, args, kwargs)` (L101-105)**: Protocol 4 constructor with kwargs support

### Slot Handling
- **`_slotnames(cls)` (L107-156)**: Discovers and caches all slot names across class hierarchy, handles name mangling

### Extension Code Registry (L158-216)
- **Three registries**: `_extension_registry` (key→code), `_inverted_registry` (code→key), `_extension_cache` (code→object)
- **Code ranges**: Standard library (1-127), Zope (128-191), 3rd party (192-239), private (240-255)

## Key Dependencies
- `functools.reduce`, `operator.or_` for union type pickling (L34-35)
- Relies on object introspection (`__class__`, `__mro__`, `__slots__`, etc.)

## Architecture Notes
- **Global state management**: Uses module-level dictionaries for type dispatch and extension registries
- **Protocol version handling**: Explicit support for different pickle protocol versions
- **Heap type detection**: Uses `_HEAPTYPE` flag (L50) to distinguish built-in vs user types
- **Defensive programming**: Graceful handling of missing attributes and failed operations

## Critical Constraints
- Extension codes must be in range 1 to 0x7fffffff
- Reduction functions must be callable
- Classes with `__slots__` require `__getstate__` for protocols 0-1
- Registry rebinding warning: pickle module captures references at initialization (L170-171)