# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/pickle.py
@source-hash: 7a134b8a4806b705
@generated: 2026-02-09T18:10:01Z

## Python Pickle Module

Core Python serialization module for creating portable serialized representations of Python objects. Supports protocol versions 0-5 with backward compatibility.

### Architecture Overview

The module provides two main implementation paths:
1. **Pure Python implementation**: `_Pickler` (L404-1175) and `_Unpickler` (L1179-1787) classes
2. **C implementation fallback**: Imports optimized classes from `_pickle` module if available (L817-831)

### Key Classes

**_Pickler (L404-1175)**: Main serialization engine
- `__init__(file, protocol=None, fix_imports=True, buffer_callback=None)` (L406-462): Configures pickler with protocol selection and compatibility options
- `dump(obj)` (L473-486): Primary serialization method, writes protocol header and object data
- `save(obj)` (L532-600): Core recursive serialization dispatcher using type dispatch table
- `memoize(obj)` (L488-508): Memo system to handle shared/recursive object references
- Protocol-specific save methods: `save_tuple` (L891-940), `save_dict` (L982-991), `save_str` (L868-889), etc.

**_Unpickler (L1179-1787)**: Main deserialization engine  
- `__init__(file, fix_imports=True, encoding="ASCII", errors="strict", buffers=None)` (L181-228): Configures unpickler with compatibility settings
- `load()` (L229-258): Main deserialization loop using opcode dispatch
- Load methods for each opcode: `load_tuple` (L472-475), `load_dict` (L515-520), etc.
- `find_class(module, name)` (L613-626): Resolves class references with security audit

**Framing Classes**:
- `_Framer` (L194-255): Handles protocol 4+ frame-based writing for large objects
- `_Unframer` (L257-312): Handles frame-based reading with buffer management

### Protocol Constants & Opcodes

**Protocol Configuration** (L54-71):
- `HIGHEST_PROTOCOL = 5`: Maximum supported protocol
- `DEFAULT_PROTOCOL = 4`: Default protocol for new pickles
- `format_version = "4.0"`: Current format version

**Opcode Constants** (L105-190): Complete set of pickle opcodes for all protocols
- Basic types: `NONE`, `INT`, `FLOAT`, `STRING`, `TUPLE`, etc.
- Protocol 2+: `PROTO`, `NEWOBJ`, `TUPLE1-3`, `NEWTRUE/NEWFALSE`
- Protocol 4+: `FRAME`, `STACK_GLOBAL`, `MEMOIZE`
- Protocol 5+: `BYTEARRAY8`, `NEXT_BUFFER`, `READONLY_BUFFER`

### Exception Hierarchy (L73-100)

- `PickleError`: Base exception class
- `PicklingError`: Raised when object cannot be pickled  
- `UnpicklingError`: Raised during unpickling failures
- `_Stop`: Internal exception for unpickling completion

### Utility Functions

**Encoding/Decoding** (L349-398):
- `encode_long(x)`: Converts integers to little-endian binary representation
- `decode_long(data)`: Reconstructs integers from binary data
- `whichmodule(obj, name)` (L330-347): Determines module containing an object

**Module Resolution**:
- `_getattribute(obj, name)` (L316-328): Safe attribute traversal with security checks

### Public API Functions (L1791-1831)

High-level convenience functions that delegate to internal classes:
- `dump(obj, file)` / `_dump()` (L1791-1793): Serialize object to file
- `dumps(obj)` / `_dumps()` (L1795-1801): Serialize object to bytes
- `load(file)` / `_load()` (L1803-1806): Deserialize from file  
- `loads(bytes)` / `_loads()` (L1808-1814): Deserialize from bytes

### Dependencies

- `copyreg`: Type registration system and dispatch tables (L27-28)
- `_compat_pickle`: Python 2/3 compatibility mappings (L37)
- `struct`: Binary data packing/unpacking (L33)
- `io`, `codecs`: Stream and encoding support (L35-36)

### Security Considerations

- `sys.audit('pickle.find_class')` calls during class resolution (L615)
- Attribute access validation in `_getattribute()` (L316-328)
- Protocol validation and size limits throughout unpickling

### CLI Interface (L834-865)

Command-line tool for inspecting pickle files with test suite integration.