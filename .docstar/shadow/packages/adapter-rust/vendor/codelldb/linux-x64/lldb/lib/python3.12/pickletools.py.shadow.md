# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/pickletools.py
@source-hash: 1d43b5d94c640f5f
@generated: 2026-02-09T18:10:01Z

## Primary Purpose
Provides "executable documentation" and analysis tools for Python's pickle module. Implements a comprehensive pickle opcode disassembler, optimizer, and documentation system for understanding pickle bytecode structure and protocols.

## Key Classes and Functions

### ArgumentDescriptor (L174-208)
Describes pickle opcode arguments with reader functions for parsing binary data from pickle streams. Contains name, byte length, reader function, and documentation.

### StackObject (L948-976)
Represents objects that can appear on the pickle virtual machine stack during unpickling. Used for stack state validation in disassembly.

### OpcodeInfo (L1093-1151) 
Comprehensive descriptor for pickle opcodes containing name, code, argument type, stack before/after states, protocol version, and documentation.

### Core Functions

**genops(pickle) (L2300-2323)**
Generator that yields (opcode, arg, pos) triples for all opcodes in a pickle. Primary API for iterating through pickle instructions.

**dis(pickle, out=None, memo=None, indentlevel=4, annotate=0) (L2395-2547)**
Main disassembly function. Produces symbolic disassembly with sanity checks for stack consistency, memo usage, and protocol compliance.

**optimize(p) (L2328-2390)**
Optimizes pickle bytecode by removing unused PUT opcodes that aren't referenced by GET operations. Maintains protocol framing.

### Binary Data Readers (L212-747)
Specialized readers for different argument types:
- read_uint1/2/4/8: Unsigned integers 
- read_int4: Signed 32-bit integer
- read_string1/4, read_bytes1/4/8: Length-prefixed strings/bytes
- read_unicodestring1/4/8: UTF-8 encoded Unicode strings
- read_floatnl, read_float8: Floating point values
- read_decimalnl_short/long: Decimal integer literals

## Architecture

### Opcode Registry (L1153-2194)
Massive opcodes list defining all pickle instructions across protocols 0-5. Each entry specifies stack effects, argument parsing, and protocol introduction version.

### Protocol Support
- Protocol 0: Text-based, printable ASCII
- Protocol 1: Binary mode with arbitrary bytes
- Protocol 2: Added PROTO, efficient integers, tuples, bools
- Protocol 3: Added bytes objects
- Protocol 4: 64-bit lengths, framing
- Protocol 5: Out-of-band buffers

### Stack Machine Model (L38-89)
Documents pickle as virtual machine with:
- Stack for temporary objects
- Memo for long-term object storage/sharing
- Linear execution until STOP opcode

## Dependencies
- `pickle`: Core pickle functionality and constants
- `struct`: Binary data unpacking via _unpack
- `io`: BytesIO for stream handling
- `codecs`: String escape decoding
- `sys`: Platform limits and output

## Notable Patterns
- Extensive docstrings with examples for each opcode
- Sanity checking during disassembly for malformed pickles
- Protocol consistency verification against pickle module
- Support for cross-pickle memo preservation
- Command-line interface for file processing

## Critical Constraints
- Maintains backward compatibility across all pickle protocols
- Stack depth validation prevents underflow
- Memo reference validation prevents undefined access
- Frame size awareness for protocol 4+ optimization