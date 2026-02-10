# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/dis.py
@source-hash: f6f02f5966fed0b1
@generated: 2026-02-09T18:13:03Z

## Purpose and Responsibility

Python bytecode disassembler providing human-readable disassembly of Python code objects, functions, and classes. Primary module for examining compiled Python bytecode through command-line interface or programmatic API.

## Core Public API Functions

- **`dis(x, *, file, depth, show_caches, adaptive)`** (L77-120): Main disassembly entry point supporting functions, code objects, classes, modules, raw bytecode, and source strings
- **`disassemble(co, lasti, *, file, show_caches, adaptive)`** (L543-551): Direct code object disassembly with current instruction highlighting
- **`distb(tb, *, file, show_caches, adaptive)`** (L122-133): Traceback disassembly using last exception
- **`get_instructions(x, *, first_line, show_caches, adaptive)`** (L342-364): Iterator yielding Instruction objects for programmatic analysis
- **`code_info(x)`** (L202-204): Formatted code object metadata display

## Key Classes

### Instruction (L288-339)
Namedtuple-based class representing single bytecode operation with fields:
- `opname`, `opcode`, `arg`, `argval`, `argrepr`, `offset`, `starts_line`, `is_jump_target`, `positions`
- Method `_disassemble()` (L304-339): Formats instruction for display output

### Bytecode (L721-790) 
Iterator class wrapping code objects for bytecode analysis:
- Constructor extracts code objects from various input types (L729-742)
- `__iter__()` (L744-753): Returns instruction iterator
- `dis()` method (L772-790): Returns formatted disassembly string
- Class method `from_traceback()` (L759-766): Constructs from traceback objects

## Critical Internal Functions

### Bytecode Parsing
- **`_get_instructions_bytes()`** (L434-541): Core instruction parser handling opcodes, arguments, caches, and jump targets
- **`_unpack_opargs(code)`** (L623-645): Unpacks bytecode into (offset, opcode, arg) tuples with extended arg handling
- **`findlabels(code)`** (L647-669): Identifies jump target offsets
- **`findlinestarts(code)`** (L671-681): Maps bytecode offsets to source line numbers

### Argument Resolution
- **`_get_const_info(op, arg, co_consts)`** (L380-390): Resolves constant references
- **`_get_name_info(name_index, get_name, **extrainfo)`** (L392-404): Resolves name references
- Specialized handling for LOAD_GLOBAL (L474-477), LOAD_ATTR (L478-481), LOAD_SUPER_ATTR (L482-485)

## Important Constants and Data Structures

- **`COMPILER_FLAG_NAMES`** (L138-149): Maps code object flags to readable names
- **`FORMAT_VALUE_CONVERTERS`** (L29-34): Format specifiers for f-string formatting
- **`MAKE_FUNCTION_FLAGS`** (L36): Function creation flags
- **Opcode mappings** (L38-50): Key opcodes cached for performance
- **`deoptmap`** (L60-62): Maps specialized opcodes back to base opcodes
- **`Positions`** (L245-254): Source position information namedtuple

## Architecture Patterns

### Polymorphic Input Handling
Functions like `dis()` and `_get_code_object()` (L172-193) extract code objects from various Python objects (functions, methods, generators, coroutines, classes, modules).

### Instruction Caching Support
Adaptive bytecode handling through `show_caches` and `adaptive` parameters, with cache entry processing in `_get_instructions_bytes()` (L520-541).

### Exception Table Processing
`_parse_exception_table()` (L415-429) and `_parse_varint()` (L406-413) handle Python 3.11+ exception table format using varint encoding.

## Key Dependencies
- `opcode` module: Provides bytecode definitions and mappings
- `types`, `collections`, `io`, `sys`: Standard library components
- Internal opcode data: `_cache_format`, `_inline_cache_entries`, `_specializations`, etc.

## Critical Constraints
- Bytecode format compatibility across Python versions
- Two-byte instruction format assumed throughout
- Exception table parsing requires Python 3.11+ format
- Cache handling dependent on opcode specialization metadata