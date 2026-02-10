# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/dis.py
@source-hash: f6f02f5966fed0b1
@generated: 2026-02-09T18:07:10Z

## Python Bytecode Disassembler Module

**Primary Purpose**: Complete implementation of Python bytecode disassembly functionality, providing human-readable disassembly output and programmatic access to bytecode instructions.

### Core Components

**Public API Functions**:
- `dis()` (L77-120): Main disassembly function handling various object types (functions, classes, code objects, strings, raw bytecode)
- `disassemble()` (L543-551): Direct code object disassembly with last instruction highlighting
- `distb()` (L122-133): Traceback disassembly (default: most recent exception)
- `get_instructions()` (L342-364): Iterator returning Instruction objects for programmatic analysis
- `code_info()` (L202-204): Formatted metadata about code objects
- `show_code()` (L238-243): Print code object details to file/stdout

**Key Classes**:
- `Instruction` (L288-340): Bytecode operation container with formatting capabilities
  - Fields: opname, opcode, arg, argval, argrepr, offset, starts_line, is_jump_target, positions
  - `_disassemble()` method (L304-339): Custom formatting for disassembly output
- `Bytecode` (L721-791): High-level bytecode analysis wrapper
  - `__iter__()` (L744-753): Iterator over instructions
  - `dis()` (L772-790): Formatted disassembly string
  - `from_traceback()` classmethod (L759-766): Construct from exception traceback

**Core Engine Functions**:
- `_get_instructions_bytes()` (L434-541): Main instruction parsing engine with cache handling
- `_unpack_opargs()` (L623-645): Low-level bytecode unpacking with extended argument support
- `_disassemble_bytes()` (L566-610): Formatted output generation with line number/offset alignment

### Instruction Analysis Helpers

**Argument Resolution**:
- `_get_const_info()` (L380-390): Constant dereferencing and repr generation
- `_get_name_info()` (L392-404): Name resolution with fallback to UNKNOWN sentinel
- Specialized handling for LOAD_GLOBAL (L474-477), LOAD_ATTR (L478-481), LOAD_SUPER_ATTR (L482-485)

**Jump Analysis**:
- `findlabels()` (L647-669): Identifies all jump targets in bytecode
- `findlinestarts()` (L671-681): Maps bytecode offsets to source line numbers
- `_is_backward_jump()` (L431-432): Detects backward jump instructions

### Advanced Features

**Cache Support**: Inline cache entry handling for specialized instructions (L520-541)
**Exception Tables**: Exception handler range parsing via `_parse_exception_table()` (L415-429)
**Adaptive Bytecode**: Support for both standard and adaptive bytecode formats via `_get_code_array()` (L199-200)
**Specialization Mapping**: Deoptimization support through `deoptmap` (L60-62) and `_deoptop()` (L195-197)

### Dependencies & Integration

**Core Imports**: opcode module for instruction definitions, types/collections for data structures
**Opcode Integration**: Imports all opcode constants and specialized instruction mappings
**Format Constants**: `_OPNAME_WIDTH=20`, `_OPARG_WIDTH=5` for output alignment

### Architecture Patterns

**Layered Design**: High-level API → instruction parsing → bytecode unpacking
**Sentinel Pattern**: UNKNOWN object (L165-170) for unresolvable values
**Iterator Protocol**: Consistent use of generators for memory efficiency
**Extensibility**: Modular argument resolution supporting new instruction types