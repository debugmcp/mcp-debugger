# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/pickletools.py
@source-hash: 1d43b5d94c640f5f
@generated: 2026-02-09T18:07:30Z

## Primary Purpose
Provides comprehensive tools for analyzing and manipulating Python pickle bytecode. This module serves as "executable documentation" for the pickle format, offering disassembly, optimization, and introspection capabilities for pickle protocols 0-5.

## Key Classes and Functions

### ArgumentDescriptor (L174-208)
Describes opcode argument types with reader functions for parsing binary data. Key instances:
- `uint1`, `uint2`, `uint4`, `uint8` (L224-312): Unsigned integer readers
- `int4` (L266-270): Signed 32-bit integer reader  
- `string1`, `string4` (L426-469): Length-prefixed string readers
- `bytes1`, `bytes4`, `bytes8` (L489-566): Length-prefixed bytes readers
- `decimalnl_short`, `decimalnl_long` (L789-810): Decimal integer parsers
- `floatnl`, `float8` (L822-867): Float parsers

### StackObject (L948-975)
Represents types that can appear on pickle stack. Key instances include `pyint`, `pybytes`, `pyunicode`, `pylist`, `pydict`, `pytuple`, `markobject`, `anyobject` (L978-1088).

### OpcodeInfo (L1093-1150)
Comprehensive opcode descriptor containing name, bytecode, argument type, stack effects, protocol version, and documentation. 

### Opcode Definitions (L1153-2194)
Massive array defining all pickle opcodes across protocols 0-5, including:
- Integer opcodes: `INT`, `BININT`, `BININT1/2`, `LONG`, `LONG1/4` (L1157-1259)
- String opcodes: `STRING`, `BINSTRING`, `SHORT_BINSTRING` (L1263-1311)
- Bytes opcodes: `BINBYTES`, `SHORT_BINBYTES`, `BINBYTES8` (L1315-1352)
- Container opcodes: `LIST`, `TUPLE`, `DICT`, `SET`, `FROZENSET` (L1510-1741)
- Stack manipulation: `POP`, `DUP`, `MARK`, `POP_MARK` (L1745-1785)
- Memo operations: `GET`, `PUT`, `MEMOIZE` variants (L1790-1874)

## Primary Functions

### genops(pickle) (L2300-2323)
Generator yielding (opcode, arg, pos) triples for each instruction in pickle bytecode. Core parsing engine used by other tools.

### dis(pickle, out=None, memo=None, indentlevel=4, annotate=0) (L2395-2547)
Symbolic disassembler producing human-readable pickle analysis with stack simulation, memo tracking, and sanity checking. Detects malformed pickles and protocol violations.

### optimize(p) (L2328-2390)
Removes unused PUT opcodes by analyzing GET references, reducing pickle size while maintaining semantics. Handles protocol detection and framing.

## Dependencies and Relationships
- Imports: `codecs`, `io`, `pickle`, `re`, `sys`, `struct` (L13-17, L210)
- Uses `pickle.bytes_types`, `pickle.decode_long`, `pickle.HIGHEST_PROTOCOL` (L21, L871, L146)
- Extensive cross-references between opcodes and argument descriptors

## Architecture Patterns
- **Descriptor Pattern**: Systematic use of descriptor objects (`ArgumentDescriptor`, `StackObject`, `OpcodeInfo`) for metadata-driven parsing
- **Generator Pattern**: `genops()` provides streaming opcode parsing without loading entire pickle
- **Stack Machine Simulation**: `dis()` emulates pickle virtual machine for validation
- **Protocol Evolution**: Comprehensive coverage of all pickle protocol versions with backward compatibility

## Critical Invariants
- Opcode uniqueness enforced at module load (L2197-2212)
- Stack effect simulation must match actual pickle behavior
- Protocol version constraints strictly observed
- Memo consistency maintained across operations
- All embedded arguments must be properly decoded

## Notable Implementation Details
- **Constants**: `UP_TO_NEWLINE=-1`, `TAKEN_FROM_ARGUMENT*` for variable-length args (L165-172)
- **Protocol Detection**: Automatic protocol detection in optimization (L2348-2354)
- **Framing Support**: Protocol 4+ framing handled in optimization (L2368-2369, L2383-2389)
- **Command-Line Interface**: Full CLI with file processing, memo preservation, annotation (L2847-2901)
- **Extensive Doctests**: Comprehensive test coverage via `_dis_test` and `_memo_test` (L2554-2836)