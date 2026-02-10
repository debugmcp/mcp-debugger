# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/pickletools.py
@source-hash: 1d43b5d94c640f5f
@generated: 2026-02-09T18:09:09Z

## Primary Purpose

Executable documentation and analysis tools for Python's pickle module. Provides deep introspection into pickle bytecode format, opcode definitions, and disassembly capabilities for debugging and educational purposes.

## Key Classes and Functions

### Core Data Structures
- **ArgumentDescriptor (L174-208)**: Describes opcode argument types with reader functions, byte lengths, and documentation. Handles variable-length arguments via special constants.
- **StackObject (L948-976)**: Represents Python object types that can appear on the pickle machine's stack during unpickling.
- **OpcodeInfo (L1093-150)**: Complete specification of pickle opcodes including stack effects, protocol version, and embedded arguments.

### Argument Readers (L212-747)
Extensive collection of binary data readers for different pickle argument formats:
- **read_uint1/2/4/8 (L212-312)**: Unsigned integer readers
- **read_int4 (L252-270)**: Signed 4-byte integer reader
- **read_string*/read_bytes*/read_unicode* families**: Various string/bytes encoding readers with length prefixes
- **read_decimalnl_* (L750-810)**: Decimal literal parsers for protocol 0
- **read_float* (L813-867)**: Float representation parsers

### Core Analysis Functions
- **genops (L2300-2323)**: Generator yielding (opcode, arg, position) tuples for all opcodes in a pickle
- **_genops (L2268-2298)**: Internal implementation handling both file objects and byte strings
- **dis (L2395-2547)**: Comprehensive pickle disassembler with stack simulation and validation
- **optimize (L2328-2390)**: Removes unused PUT opcodes to reduce pickle size

### Opcode Registry
- **opcodes list (L1153-2194)**: Comprehensive catalog of all pickle opcodes across protocols 0-5
- **code2op dict (L2219-2222)**: Maps opcode bytes to OpcodeInfo instances
- **assure_pickle_consistency (L2224-2263)**: Validates consistency with pickle module's opcodes

## Important Dependencies

- **pickle module**: Source of truth for opcode constants and decode_long function
- **struct**: Binary data unpacking via `_unpack`
- **io.BytesIO**: Stream handling for pickle data
- **codecs**: String escape sequence processing

## Architectural Decisions

### Pickle Virtual Machine Model
Implements complete model of pickle's stack-based virtual machine:
- Stack simulation for validation (L2440-2547)
- Memo tracking for object references (L2489-2510)
- Mark object handling for variable-argument opcodes (L2462-2487)

### Protocol Evolution Support
Comprehensive coverage of all pickle protocols (0-5) with backward compatibility:
- Protocol-specific opcode availability tracking
- Argument format variations across versions
- Optimization strategies for different protocol levels

### Extensible Documentation System
Self-documenting architecture where opcode specifications include:
- Stack effects (before/after states)
- Human-readable documentation
- Protocol version introduction
- Argument format specifications

## Critical Invariants

1. **Opcode Uniqueness**: Names and codes must be unique across the opcodes list (L2197-2212)
2. **Stack Consistency**: All opcodes must specify valid stack transformations
3. **Pickle Compatibility**: Must match pickle module's opcode constants exactly
4. **Protocol Ordering**: Opcodes introduced in higher protocols cannot be used in lower protocols

## Notable Patterns

- **Descriptor Pattern**: Extensive use of descriptor objects for self-documenting data structures
- **Generator-based Parsing**: Stream processing via generators for memory efficiency
- **Stack Machine Emulation**: Complete simulation of pickle virtual machine for validation
- **Protocol Versioning**: Careful tracking of feature availability across pickle protocol versions