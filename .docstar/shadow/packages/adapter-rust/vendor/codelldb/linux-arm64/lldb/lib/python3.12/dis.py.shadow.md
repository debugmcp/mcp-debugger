# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/dis.py
@source-hash: f6f02f5966fed0b1
@generated: 2026-02-09T18:08:47Z

## Python Bytecode Disassembler

Core module providing comprehensive Python bytecode disassembly functionality. Converts compiled Python bytecode into human-readable mnemonics with detailed instruction analysis.

### Primary Functions

**`dis(x, *, file=None, depth=None, show_caches=False, adaptive=False)`** (L77-120)
- Main entry point for disassembly. Handles functions, methods, classes, code objects, raw bytecode, and source strings
- Auto-extracts code objects from various Python constructs (functions, generators, coroutines)
- Recursively disassembles class/module members
- Falls back to traceback disassembly when called with no arguments

**`get_instructions(x, *, first_line=None, show_caches=False, adaptive=False)`** (L342-364)
- Returns iterator of `Instruction` namedtuples for detailed bytecode analysis
- Core function used by higher-level disassembly routines

**`disassemble(co, lasti=-1, *, file=None, show_caches=False, adaptive=False)`** (L543-551)
- Direct code object disassembly with current instruction highlighting
- Used by debuggers and traceback analysis

### Key Classes

**`Instruction`** (L288-340)
- Namedtuple subclass representing single bytecode operation
- Fields: opname, opcode, arg, argval, argrepr, offset, starts_line, is_jump_target, positions
- `_disassemble()` method (L304-339) formats instruction for display with configurable column widths

**`Bytecode`** (L721-791)
- High-level wrapper for code object analysis
- Provides iterator interface and formatted output methods
- `from_traceback()` classmethod (L759-766) for debugger integration
- `dis()` method (L772-790) returns formatted disassembly string

**`Positions`** (L245-254)
- Namedtuple for source position tracking (lineno, end_lineno, col_offset, end_col_offset)

### Core Data Structures

**Opcode mappings** (L28-58)
- Constants for key opcodes (FORMAT_VALUE, MAKE_FUNCTION, LOAD_CONST, etc.)
- `_all_opname`/`_all_opmap` (L52-58) - Extended opcode tables including specializations
- `deoptmap` (L60-62) - Maps specialized instructions back to base operations

**Format constants** (L29-36, L285-286)
- `FORMAT_VALUE_CONVERTERS` - String formatting type mappings
- `MAKE_FUNCTION_FLAGS` - Function creation flag descriptions
- `_OPNAME_WIDTH`, `_OPARG_WIDTH` - Display formatting widths

### Instruction Processing

**`_get_instructions_bytes()`** (L434-541)
- Core bytecode parsing engine
- Handles instruction arguments, jump targets, cache entries
- Processes specialized instruction variants
- Supports both standard and adaptive bytecode formats

**`_unpack_opargs(code)`** (L623-645)
- Low-level bytecode unpacking with EXTENDED_ARG handling
- Manages inline cache entry skipping
- Handles integer overflow for large arguments

### Utility Functions

**Code object extraction**: `_get_code_object()` (L172-193), `_try_compile()` (L64-75)
**Jump analysis**: `findlabels()` (L647-669), `findlinestarts()` (L671-681)  
**Name resolution**: `_get_name_info()` (L392-404), `_get_const_info()` (L380-390)
**Exception table parsing**: `_parse_exception_table()` (L415-429)

### Dependencies
- `opcode` module for bytecode definitions and mappings
- `types`, `collections` for type checking and data structures
- `sys`, `io` for system integration and output handling

### Architecture Notes
- Supports both standard and adaptive bytecode via `adaptive` parameter
- Handles Python 3.11+ inline caching with `show_caches` option
- Exception table integration for comprehensive flow analysis
- Extensible design supports specialized instruction variants
- Backward compatibility alias `disco = disassemble` (L615)