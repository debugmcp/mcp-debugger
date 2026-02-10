# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/pickletools.py
@source-hash: 1d43b5d94c640f5f
@generated: 2026-02-09T18:08:35Z

## Primary Purpose
Provides "executable documentation" and analysis tools for Python's pickle module. Contains comprehensive documentation of pickle opcodes, protocols, and the virtual pickle machine architecture, plus utilities for disassembling and optimizing pickles.

## Key Classes and Functions

### Argument Type Descriptors (L174-747)
- **ArgumentDescriptor (L174-208)**: Base class describing pickle opcode argument formats with reader functions
- **Reader Functions (L212-747)**: Binary data readers for various formats:
  - `read_uint1/2/4/8` (L212-312): Unsigned integer readers
  - `read_int4` (L252-264): Signed 4-byte integer reader  
  - `read_string*` (L315-469): String readers with various encodings
  - `read_bytes*` (L472-601): Raw byte readers
  - `read_unicode*` (L603-747): Unicode string readers
  - `read_decimal*` (L750-810): Decimal number readers
  - `read_float*` (L813-867): Float readers

### Stack Object Descriptors (L948-1089)
- **StackObject (L948-975)**: Describes object types that can appear on pickle virtual machine stack
- **Pre-defined stack objects (L978-1089)**: Common Python types like `pyint`, `pybytes_or_str`, `pylist`, `pydict`, etc.

### Opcode Information System (L1093-2194)
- **OpcodeInfo (L1093-1150)**: Complete descriptor for each pickle opcode including name, code, arguments, stack effects, protocol version, and documentation
- **opcodes list (L1153-2194)**: Comprehensive database of all pickle opcodes across all protocol versions, organized by functionality:
  - Integer opcodes: INT, BININT, LONG, etc. (L1157-1260)
  - String/bytes opcodes: STRING, BINSTRING, BINBYTES, etc. (L1263-1367) 
  - Container opcodes: LIST, TUPLE, DICT, SET (L1510-1741)
  - Stack manipulation: POP, DUP, MARK (L1745-1785)
  - Memo operations: GET, PUT, MEMOIZE (L1790-1874)
  - Object construction: REDUCE, BUILD, NEWOBJ (L1955-2119)

### Core Analysis Functions (L2268-2547)
- **genops() (L2300-2323)**: Generator yielding (opcode, arg, pos) triples from pickle data
- **optimize() (L2328-2390)**: Removes unused PUT opcodes to reduce pickle size
- **dis() (L2395-2547)**: Symbolic disassembler with stack emulation and sanity checking

### Command-Line Interface (L2846-2901)
Argument parser for command-line pickle disassembly with options for output formatting, memo preservation, and annotation.

## Architecture and Design Patterns

### Virtual Machine Documentation (L38-149)
Extensive inline documentation of the pickle virtual machine model:
- Stack-based execution with memo (long-term memory)
- Protocol evolution and backward compatibility constraints
- Object identity and recursive object handling

### Descriptor Pattern (L151-155)
Uses descriptor objects rather than meta-language for opcode specifications, enabling programmatic analysis while maintaining human readability.

### Protocol Version Management
- Opcodes tagged with protocol version numbers
- Consistency checking with pickle module (L2224-2262)
- Support for protocols 0-5 with feature evolution

## Key Dependencies
- `pickle`: Core pickle functionality and opcode constants
- `struct`: Binary data unpacking via `_unpack`
- `io`: BytesIO for stream handling
- `codecs`: String escape handling

## Notable Invariants
- Opcode names and codes must be unique (verified L2197-2212)
- Stack effects must be properly specified for disassembler
- All opcodes maintain backward compatibility - never removed, only added
- Memo indices must be defined before use (checked in dis())

## Critical Usage Notes
- Primarily designed for AI agent consumption of pickle internals
- dis() performs extensive validation beyond just disassembly
- optimize() can significantly reduce pickle sizes by removing dead PUT operations
- Command-line interface supports batch processing of multiple pickle files