# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/pickle.py
@source-hash: 7a134b8a4806b705
@generated: 2026-02-09T18:07:26Z

## Primary Purpose
Python's pickle module implementation for serializing/deserializing Python objects to/from binary format. Supports protocols 0-5 with backward compatibility and optimizations for different data types.

## Key Classes and Functions

### Exception Classes (L73-99)
- `PickleError` (L73): Base exception for all pickle-related errors
- `PicklingError` (L77): Raised when object cannot be pickled
- `UnpicklingError` (L84): Raised during unpickling problems
- `_Stop` (L97): Internal exception to signal successful unpickling completion

### Protocol Constants (L54-71)
- `HIGHEST_PROTOCOL = 5` (L66): Maximum supported protocol version
- `DEFAULT_PROTOCOL = 4` (L71): Default protocol for new pickles
- `format_version` and `compatible_formats` (L54-63): Version metadata

### Opcode Constants (L105-190)
Extensive set of pickle opcodes organized by protocol version:
- Basic operations: `MARK`, `STOP`, `POP` etc. (L105-148)
- Protocol 2 additions: `PROTO`, `NEWOBJ`, `TUPLE1-3` (L152-164)
- Protocol 3: `BINBYTES`, `SHORT_BINBYTES` (L169-170)
- Protocol 4: `SHORT_BINUNICODE`, `MEMOIZE`, `FRAME` (L174-183)
- Protocol 5: `BYTEARRAY8`, `NEXT_BUFFER`, `READONLY_BUFFER` (L187-190)

### Frame Management (L194-312)
- `_Framer` (L194): Handles protocol 4+ frame-based writing with 64KB target size
- `_Unframer` (L257): Corresponding frame reader for unpickling

### Core Pickler Class `_Pickler` (L404-1175)
Primary serialization engine with key methods:
- `__init__` (L406): Configures protocol, file handle, and options
- `dump` (L473): Main entry point for pickling objects
- `save` (L532): Core recursive serialization dispatcher
- `memoize` (L488): Handles object reference tracking to prevent cycles
- Type-specific save methods: `save_none`, `save_bool`, `save_long`, `save_str`, etc. (L737-1174)
- `save_global` (L1071): Handles module/class references
- Batch optimization methods: `_batch_appends`, `_batch_setitems` (L955-1022)

### Core Unpickler Class `_Unpickler` (L1179-1787)
Primary deserialization engine with key methods:
- `__init__` (L1181): Sets up file readers, encoding options, buffer handling
- `load` (L1229): Main unpickling loop using opcode dispatch
- `pop_mark` (L1260): Stack management for nested structures  
- Load methods for each opcode: `load_proto`, `load_int`, `load_string`, etc. (L1271-1786)
- `find_class` (L1613): Locates and imports classes during unpickling
- `persistent_load` (L1266): Hook for custom persistent object handling

### Utility Functions (L316-397)
- `_getattribute` (L316): Safe attribute traversal with security checks
- `whichmodule` (L330): Determines module containing an object
- `encode_long`/`decode_long` (L349/379): Two's complement encoding for large integers

### Public API Functions (L1791-1831)
- `_dump`, `_dumps` (L1791/1795): Internal dump implementations
- `_load`, `_loads` (L1803/1808): Internal load implementations
- Actual exports determined by `_pickle` C module fallback (L1817-1831)

## Dependencies
- `copyreg`: Custom pickling registration
- `_compat_pickle`: Python 2/3 compatibility mappings
- `struct`: Binary data packing/unpacking
- `io`, `codecs`: File and encoding operations
- Optional `_pickle` C extension for performance

## Architecture Patterns
- **Opcode-based state machine**: Unpickler uses dispatch table for opcode handling
- **Protocol versioning**: Backward-compatible protocol evolution
- **Memoization**: Prevents infinite recursion and enables object sharing
- **Framing**: Protocol 4+ uses frames for better I/O performance
- **Fallback pattern**: Pure Python implementation with optional C acceleration

## Critical Invariants
- All pickles end with STOP opcode
- Memo indices must be unique and sequential
- Protocol version must be declared before data
- Frame boundaries cannot split atomic operations
- Buffer callbacks only available in protocol 5+