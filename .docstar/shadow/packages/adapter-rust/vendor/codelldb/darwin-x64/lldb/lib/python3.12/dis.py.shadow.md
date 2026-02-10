# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/dis.py
@source-hash: f6f02f5966fed0b1
@generated: 2026-02-09T18:07:51Z

## Python Bytecode Disassembler

**Primary Purpose:** Python standard library module that provides comprehensive bytecode disassembly functionality for analyzing compiled Python code objects, functions, methods, and raw bytecode.

### Core Disassembly Functions

- **`dis(x, *, file=None, depth=None, show_caches=False, adaptive=False)` (L77-120)**: Main entry point for disassembling various Python objects (functions, methods, code objects, classes, modules, strings, raw bytecode)
- **`disassemble(co, lasti=-1, *, file=None, show_caches=False, adaptive=False)` (L543-551)**: Direct code object disassembly with optional current instruction highlighting
- **`distb(tb=None, *, file=None, show_caches=False, adaptive=False)` (L122-133)**: Disassemble from traceback objects for debugging

### Key Classes

- **`Instruction` (L288-339)**: Named tuple subclass representing a single bytecode instruction with fields: opname, opcode, arg, argval, argrepr, offset, starts_line, is_jump_target, positions. Includes `_disassemble()` method for formatted output.
- **`Bytecode` (L721-790)**: Iterator wrapper around code objects providing convenient bytecode analysis interface with methods `info()`, `dis()`, and `from_traceback()` class method
- **`Positions` (L245-254)**: Named tuple for source code position information (lineno, end_lineno, col_offset, end_col_offset)

### Instruction Processing Engine

- **`get_instructions(x, *, first_line=None, show_caches=False, adaptive=False)` (L342-364)**: High-level iterator returning Instruction objects from various input types
- **`_get_instructions_bytes()` (L434-541)**: Core bytecode parsing engine that handles opcode decoding, argument resolution, cache entries, and position mapping
- **`_unpack_opargs(code)` (L623-645)**: Low-level bytecode unpacking with extended argument and cache handling

### Opcode Analysis & Utilities

- **Opcode mappings (L28-58)**: Constants for major opcodes and specialized instruction handling via `_all_opname`, `_all_opmap`, and `deoptmap`
- **`_deoptop(op)` (L195-197)**: Maps specialized opcodes back to base operations
- **`findlabels(code)` (L647-669)**: Identifies jump targets in bytecode
- **`findlinestarts(code)` (L671-681)**: Maps bytecode offsets to source line numbers

### Argument Resolution Helpers

- **`_get_const_info()` (L380-390)**: Resolves constant references with repr formatting
- **`_get_name_info()` (L392-404)**: Resolves name references from name tables
- **Special opcode handlers (L471-516)**: Custom argument processing for LOAD_GLOBAL, LOAD_ATTR, BINARY_OP, FORMAT_VALUE, etc.

### Code Analysis Features

- **`code_info(x)` (L202-204)** and **`_format_code_info(co)` (L206-236)**: Detailed code object metadata display
- **`_find_imports(co)` (L683-703)**: Extract import statements from bytecode
- **`_find_store_names(co)` (L705-718)**: Identify variable assignments
- **`_parse_exception_table(code)` (L415-429)**: Parse exception handling metadata

### Dependencies & Integration

- **Core imports**: `sys`, `types`, `collections`, `io`, and comprehensive `opcode` module integration
- **Format constants (L285-286)**: `_OPNAME_WIDTH=20`, `_OPARG_WIDTH=5` for output formatting
- **Compiler flag mapping (L138-149)**: `COMPILER_FLAG_NAMES` for code object flag interpretation

### Key Architectural Patterns

- **Polymorphic input handling**: Consistent interface accepting functions, methods, code objects, strings, or raw bytecode
- **Lazy evaluation**: Iterator-based instruction processing with optional caching display
- **Modular argument resolution**: Pluggable resolvers for different opcode argument types
- **Adaptive/specialized instruction support**: Handles Python's bytecode specialization optimizations