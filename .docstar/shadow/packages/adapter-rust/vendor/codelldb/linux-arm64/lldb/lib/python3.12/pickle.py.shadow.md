# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/pickle.py
@source-hash: 7a134b8a4806b705
@generated: 2026-02-09T18:09:00Z

**Core Purpose**: Python's standard pickle module implementation for serializing/deserializing Python objects to/from portable byte streams. Supports protocols 0-5 with backward compatibility.

**Key Classes & Functions**:

**Exception Hierarchy (L73-93)**:
- `PickleError(Exception)` - Base class for all pickle exceptions
- `PicklingError(PickleError)` - Raised for unpicklable objects  
- `UnpicklingError(PickleError)` - Raised for unpickling problems
- `_Stop(Exception)` - Internal exception to signal end of unpickling (L97-99)

**Serialization Engine**:
- `_Pickler` class (L404-1175) - Core pickling implementation
  - `__init__()` (L406-461) - Configure protocol, file object, buffer callbacks
  - `dump()` (L473-486) - Main entry point to serialize object
  - `save()` (L532-600) - Recursive object serialization dispatcher
  - Type-specific save methods (L737-1174) for primitives, collections, globals
  - Memoization system (L488-508) to handle shared/recursive references
  - Protocol framing via `_Framer` (L194-255) for efficient I/O

**Deserialization Engine**:
- `_Unpickler` class (L1179-1786) - Core unpickling implementation  
  - `__init__()` (L1181-1227) - Configure file object, encoding, buffers
  - `load()` (L1229-1257) - Main dispatcher reading opcodes and executing
  - Opcode dispatch table (L1269) maps bytes to load methods
  - Individual load methods (L1271-1786) for each pickle opcode
  - `find_class()` (L1613-1625) - Security-critical class resolution

**Protocol Support**:
- Constants: `HIGHEST_PROTOCOL=5`, `DEFAULT_PROTOCOL=4` (L66-71)
- Extensive opcode definitions (L105-190) for all protocol versions
- Binary encoding helpers: `encode_long()`, `decode_long()` (L349-397)
- Protocol negotiation and compatibility handling

**I/O Management**:
- `_Framer` class (L194-255) - Manages protocol 4+ frame-based output
- `_Unframer` class (L257-312) - Handles framed input parsing
- Buffer management for protocol 5 out-of-band data

**Public API (L1791-1831)**:
- Shorthand functions: `dump()`, `dumps()`, `load()`, `loads()`
- Falls back to C implementation (`_pickle`) if available (L1817-1831)

**Architectural Patterns**:
- Dispatch table pattern for opcode handling and type serialization
- Memoization for object identity preservation and cycle detection
- Protocol versioning with backward compatibility
- Extension registry system for custom object types
- Framing system for efficient large object handling

**Critical Dependencies**:
- `copyreg` module for custom reducer registration
- `_compat_pickle` for Python 2/3 compatibility
- `struct` for binary data packing/unpacking
- Optional `_pickle` C extension for performance

**Security Considerations**:
- `find_class()` method as customization point for class loading restrictions
- Audit hooks via `sys.audit()` for class resolution monitoring
- Protocol validation and bounds checking throughout