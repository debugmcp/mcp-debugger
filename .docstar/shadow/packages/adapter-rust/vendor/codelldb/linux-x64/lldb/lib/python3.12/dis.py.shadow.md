# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/dis.py
@source-hash: f6f02f5966fed0b1
@generated: 2026-02-09T18:09:49Z

This is Python's standard library bytecode disassembler module (`dis`), providing tools to examine, analyze and display Python bytecode instructions in human-readable format.

## Primary Purpose
Converts Python bytecode into readable assembly-like mnemonics for debugging, optimization analysis, and educational purposes. Supports both interactive disassembly and programmatic bytecode inspection.

## Key Classes

**Instruction (L288-340)**: Named tuple subclass representing a single bytecode operation
- Extends `_Instruction` namedtuple (L256-270) with formatting capabilities
- `_disassemble()` method (L304-339) formats instruction for display output
- Fields: opname, opcode, arg, argval, argrepr, offset, starts_line, is_jump_target, positions

**Bytecode (L721-791)**: High-level interface for bytecode analysis
- `__init__()` (L729-742) accepts functions, methods, code objects, or source strings
- `__iter__()` (L744-753) yields Instruction instances
- `dis()` method (L772-790) returns formatted disassembly string
- `from_traceback()` classmethod (L759-766) creates from exception traceback

**Positions (L245-254)**: Named tuple for source code position tracking
- Fields: lineno, end_lineno, col_offset, end_col_offset

## Core Functions

**dis() (L77-120)**: Main entry point for disassembly
- Handles multiple input types: functions, classes, code objects, strings, bytes
- Recursive disassembly for classes and modules
- Delegates to specialized `_disassemble_*` functions

**get_instructions() (L342-364)**: Iterator yielding Instruction objects
- Calls `_get_instructions_bytes()` (L434-541) for low-level bytecode parsing
- Supports adaptive bytecode and cache display options

**disassemble() (L543-551)**: Disassembles code objects with current instruction marking
- Used by `distb()` (L122-133) for traceback disassembly

## Helper Functions

**_get_code_object() (L172-193)**: Extracts code objects from various input types
- Handles methods, functions, generators, coroutines, and source strings
- Uses `_try_compile()` (L64-75) for string compilation

**_unpack_opargs() (L623-645)**: Low-level bytecode parsing
- Handles EXTENDED_ARG instructions and inline caches
- Manages integer overflow for opargs

**findlabels() (L647-669)**: Identifies jump targets in bytecode
**findlinestarts() (L671-681)**: Maps bytecode offsets to source line numbers

## Constants and Mappings

- **Opcode constants (L28-50)**: Direct opcode lookups (FORMAT_VALUE, MAKE_FUNCTION, etc.)
- **COMPILER_FLAG_NAMES (L138-149)**: Maps code object flags to readable names  
- **_all_opname/_all_opmap (L52-58)**: Extended opcode mappings including specializations
- **deoptmap (L60-62)**: Maps specialized opcodes back to base opcodes

## Architecture Patterns

- **Strategy pattern**: Different `_disassemble_*` functions handle various input types
- **Iterator pattern**: Core parsing yields instruction sequences
- **Template method**: Instruction formatting separated from parsing logic
- **Facade pattern**: `dis()` and `Bytecode` provide simplified interfaces

## Critical Dependencies

- **opcode module**: Provides all opcode definitions, mappings, and categorizations
- **types module**: For type checking code-bearing objects
- **collections**: Named tuple implementations
- **sys**: Traceback access and system introspection

## Key Invariants

- Bytecode offset calculations must account for 2-byte instructions and inline caches
- Jump target resolution requires proper handling of relative vs absolute addresses
- Line number mapping maintains consistency between bytecode and source positions
- Extended arguments properly reconstruct from multi-byte sequences