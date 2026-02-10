# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/opcode.py
@source-hash: 192f6008508f28d3
@generated: 2026-02-09T18:07:13Z

## Purpose
Python bytecode opcode definitions and metadata module. Provides comprehensive mapping of Python 3.12 bytecode instructions, their properties, and categorization for use by disassemblers, optimizers, and other bytecode analysis tools.

## Core Data Structures
- **opmap** (L45): Dictionary mapping opcode names to numeric values
- **opname** (L284-286): List providing reverse mapping from opcode numbers to names
- **Category lists** (L26-34): Specialized lists categorizing opcodes by argument types:
  - `hasarg`, `hasconst`, `hasname`, `hasjrel`, `hasjabs`, `haslocal`, `hascompare`, `hasfree`, `hasexc`

## Opcode Definition Functions
- **def_op()** (L51-52): Basic opcode registration
- **name_op()** (L54-56): Registers opcodes that reference name table
- **jrel_op()** (L58-60): Registers relative jump opcodes
- **jabs_op()** (L62-64): Registers absolute jump opcodes  
- **pseudo_op()** (L66-74): Registers pseudo-opcodes that map to real opcodes

## Key Constants
- **HAVE_ARGUMENT** (L138): Threshold (90) - opcodes ≥90 have arguments
- **EXTENDED_ARG** (L206): Special opcode (144) for extending argument range
- **MIN_PSEUDO_OPCODE/MAX_PSEUDO_OPCODE** (L260, L280): Pseudo-opcode range boundaries
- **MIN_INSTRUMENTED_OPCODE** (L236): Start of instrumented opcodes (237)

## Opcode Categories
**Regular opcodes** (L80-235): Standard Python bytecode instructions (0-236)
**Instrumented opcodes** (L238-255): Debugging/profiling variants (237-255)  
**Pseudo opcodes** (L262-278): Compiler-internal opcodes that resolve to real ones (256+)

## Specialization Support
- **_specializations** (L341-438): Maps base opcodes to their optimized variants
- **_cache_format** (L443-489): Cache structure definitions for specialized opcodes
- **_inline_cache_entries** (L491-493): Pre-computed cache sizes per opcode

## Helper Functions
- **is_pseudo()** (L39-40): Tests if opcode is in pseudo range
- **stack_effect** (L19-22): Imported from _opcode if available

## Dependencies
- Optional import from `_opcode` module for stack effect calculation
- Self-contained opcode definitions with no external dependencies

## Architecture Notes
- Uses helper functions to build opcode categories during module initialization
- Cleans up helper functions after initialization (L282)
- Supports both regular and specialized opcode variants for performance optimization
- Maintains backward compatibility through pseudo-opcode mapping system