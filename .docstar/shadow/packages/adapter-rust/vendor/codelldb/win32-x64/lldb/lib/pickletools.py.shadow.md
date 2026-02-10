# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/pickletools.py
@source-hash: 1d43b5d94c640f5f
@generated: 2026-02-09T18:13:19Z

## Python Pickle Tools Analysis & Disassembly Module

**Primary Purpose**: Provides comprehensive tools for analyzing, debugging, and optimizing Python pickle bytecode. This is the reference implementation for understanding pickle protocol internals and virtual machine operations.

### Core Architecture

**Pickle Virtual Machine Model (L38-89)**: Extensive documentation of the pickle machine (PM) architecture with stack-based execution, memo storage for object identity, and protocol evolution considerations. Critical for understanding pickle internals.

**Argument Type System (L174-747)**:
- `ArgumentDescriptor` (L174-208): Base class defining opcode argument structure with reader functions
- Binary readers for integers: `read_uint1` (L212), `read_uint2` (L231), `read_int4` (L252), `read_uint4` (L273), `read_uint8` (L294)
- String/bytes readers: `read_stringnl` (L315), `read_string1` (L409), `read_bytes1` (L472), `read_bytearray8` (L569)
- Unicode readers: `read_unicodestringnl` (L603), `read_unicodestring1` (L629)
- Numeric readers: `read_decimalnl_short` (L750), `read_floatnl` (L813), `read_float8` (L835)

**Object Type System (L948-1088)**:
- `StackObject` (L948-976): Describes types that can appear on the pickle stack
- Predefined stack objects for Python types: `pyint` (L978), `pybytes` (L1003), `pyunicode` (L1013), `pytuple` (L1023), etc.
- Special objects: `markobject` (L1058) for variable-length operations, `stackslice` (L1072) for bulk operations

### Opcode Definition System

**OpcodeInfo Structure (L1093-1150)**: Complete opcode descriptor with name, bytecode, argument type, stack effects, protocol version, and documentation.

**Comprehensive Opcode Registry (L1153-2194)**: Complete catalog of all pickle opcodes across protocols 0-5:
- Integer opcodes: `INT` (L1157), `BININT` (L1182), `LONG1` (L1239)
- String/bytes opcodes: `STRING` (L1263), `BINBYTES` (L1315), `BYTEARRAY8` (L1356)
- Container opcodes: `LIST` (L1546), `TUPLE` (L1572), `DICT` (L1643), `FROZENSET` (L1727)
- Stack manipulation: `MARK` (L1761), `POP` (L1745), `DUP` (L1753)
- Memory operations: `PUT` (L1827), `GET` (L1790), `MEMOIZE` (L1864)
- Object construction: `REDUCE` (L1955), `BUILD` (L1984), `NEWOBJ` (L2091)
- Control flow: `PROTO` (L2123), `STOP` (L2135), `FRAME` (L2150)

### Key Analysis Functions

**genops() (L2300-2323)**: Core opcode generator that parses pickle bytecode into `(opcode, arg, pos)` tuples. Foundation for all analysis operations.

**dis() (L2395-2547)**: Comprehensive pickle disassembler with:
- Stack simulation for validation (L2440)
- Memo tracking for consistency checks (L2490-2510)
- Protocol version detection (L2456)
- Indented output for MARK blocks (L2452-2454)
- Optional annotations (L2519-2525)

**optimize() (L2328-2390)**: Pickle optimizer that removes unused PUT opcodes by:
- Tracking PUT/GET relationships (L2338-2351)
- Rebuilding optimized bytecode (L2364-2390)
- Maintaining protocol compliance

### Protocol Evolution Support

**Multi-Protocol Compatibility (L92-148)**: Documents protocol 0 (text), protocol 1 (binary), protocol 2 (new-style classes), and later additions. Critical for understanding backward compatibility.

**Consistency Validation (L2224-2262)**: `assure_pickle_consistency()` ensures this module stays synchronized with the main pickle module.

### Dependencies & Integration

**External Dependencies**: `pickle`, `io`, `sys`, `struct`, `codecs`, `re` modules for core functionality.

**Integration Points**: Designed to work with pickle module internals, uses `pickle.decode_long` (L871) and validates against `pickle.__all__`.

### Usage Patterns

**Interactive Analysis**: Primary use as command-line tool (L2846-2901) for pickle file analysis with various output options.

**Programmatic Access**: `genops()`, `dis()`, and `optimize()` functions for embedding in other tools.

**Educational/Debugging**: Extensive documentation and examples for understanding pickle internals.

### Critical Invariants

- All opcodes must have unique names and codes (L2197-2212)
- Stack simulation must remain consistent during disassembly
- Memo references must be defined before use
- Protocol version compatibility must be maintained