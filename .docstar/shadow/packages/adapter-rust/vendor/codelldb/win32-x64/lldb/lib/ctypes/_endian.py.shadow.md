# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/ctypes/_endian.py
@source-hash: c5d692bdce10dfee
@generated: 2026-02-09T18:10:28Z

**Purpose**: Provides byte order (endianness) support for ctypes structures and unions, enabling cross-platform binary data handling by creating little-endian and big-endian variants of data structures.

**Core Architecture**:
- Runtime endianness detection using `sys.byteorder` (L43, L60) 
- Conditional class definitions based on host system endianness
- Metaclass-based field transformation for non-native endianness

**Key Functions**:
- `_other_endian(typ)` (L6-21): Core type transformation function that converts ctypes to opposite endianness
  - Handles primitive types via `__ctype_be__`/`__ctype_le__` attributes (L13-14)
  - Recursively processes arrays by transforming element type (L16-17)  
  - Returns structures/unions unchanged (L19-20)
  - Raises TypeError for unsupported types (L21)

**Metaclasses**:
- `_swapped_meta` (L23-33): Base metaclass that intercepts `_fields_` assignment and transforms field types
- `_swapped_struct_meta` (L34): Structure-specific metaclass combining swapped behavior with Structure metaclass
- `_swapped_union_meta` (L35): Union-specific metaclass combining swapped behavior with Union metaclass

**Exported Classes** (conditional on system endianness):
- On little-endian systems (L43-58):
  - `LittleEndianStructure` = native `Structure`
  - `BigEndianStructure`: Structure with swapped byte order, uses `_swapped_struct_meta`
  - `LittleEndianUnion` = native `Union`  
  - `BigEndianUnion`: Union with swapped byte order, uses `_swapped_union_meta`

- On big-endian systems (L60-75): 
  - `BigEndianStructure` = native `Structure`
  - `LittleEndianStructure`: Structure with swapped byte order
  - `BigEndianUnion` = native `Union`
  - `LittleEndianUnion`: Union with swapped byte order

**Critical Design Notes**:
- `_swappedbytes_` attribute presence (not value) signals bit field ordering to Structure metaclass (L40-41)
- `__slots__ = ()` prevents additional instance attributes (L50, L57, L67, L74)
- `_OTHER_ENDIAN` constant set to appropriate ctypes attribute name based on host endianness (L44, L61)

**Dependencies**: 
- `sys` for byteorder detection
- `ctypes` for Structure, Union, and Array types
- Assumes ctypes primitive types have `__ctype_be__`/`__ctype_le__` attributes