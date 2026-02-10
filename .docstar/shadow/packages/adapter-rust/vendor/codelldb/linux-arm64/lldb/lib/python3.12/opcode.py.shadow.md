# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/opcode.py
@source-hash: 192f6008508f28d3
@generated: 2026-02-09T18:09:00Z

**Python Opcode Definitions and Metadata Module**

This module defines Python 3.12 bytecode opcodes and their metadata for the CPython interpreter. It serves as the authoritative registry for all opcodes, their classifications, and specialization information.

## Core Data Structures

**Opcode Classification Lists (L26-34):**
- `hasarg`, `hasconst`, `hasname`, `hasjrel`, `hasjabs`, `haslocal`, `hascompare`, `hasfree`, `hasexc` - Empty lists populated dynamically to categorize opcodes by their argument types and behaviors

**Primary Mappings:**
- `opmap` (L45) - Dictionary mapping opcode names to their numeric values
- `opname` (L284-286) - List providing reverse mapping from opcode numbers to names
- `_pseudo_ops` (L49) - Maps pseudo opcodes to their real opcode equivalents

## Opcode Definition Functions

**Registration Functions (L51-75):**
- `def_op(name, op)` (L51-52) - Basic opcode registration
- `name_op(name, op)` (L54-56) - Registers name-referencing opcodes
- `jrel_op(name, op)` (L58-60) - Registers relative jump opcodes  
- `jabs_op(name, op)` (L62-64) - Registers absolute jump opcodes
- `pseudo_op(name, op, real_ops)` (L66-74) - Registers pseudo opcodes with target mappings

## Opcode Definitions

**Basic Operations (L80-137):**
Standard Python bytecode operations including stack manipulation (`POP_TOP`, `PUSH_NULL`), unary operations (`UNARY_NEGATIVE`, `UNARY_NOT`), control flow (`END_FOR`, `RETURN_VALUE`), and exception handling.

**Argument-Taking Operations (L138-233):**
Operations with the `HAVE_ARGUMENT` threshold at 90. Includes name operations (`STORE_NAME`, `LOAD_NAME`), local variable operations (`LOAD_FAST`, `STORE_FAST`), jumps (`FOR_ITER`, `JUMP_FORWARD`), and function calls (`CALL`).

**Instrumented Operations (L236-256):**
Debugging/profiling variants of standard operations starting at `MIN_INSTRUMENTED_OPCODE = 237`.

**Pseudo Operations (L260-279):**
Compiler-only opcodes (256+) that map to real opcodes during code generation, including `SETUP_FINALLY`, `JUMP`, and `LOAD_METHOD`.

## Specialization System

**Utility Functions:**
- `is_pseudo(op)` (L39-40) - Tests if opcode is in pseudo range
- `ENABLE_SPECIALIZATION = True` (L37) - Feature flag

**Specialization Mappings (L341-438):**
- `_specializations` - Maps base opcodes to their specialized variants (e.g., `BINARY_OP` → `BINARY_OP_ADD_INT`)
- `_specialized_instructions` (L439-441) - Flattened list of all specialized opcodes

**Cache Configuration (L443-492):**
- `_cache_format` - Defines cache entry layouts for specialized opcodes
- `_inline_cache_entries` - Calculated cache sizes per opcode

## Constant Definitions

**Binary/Intrinsic Operations (L289-339):**
- `_nb_ops` - Maps numeric operation names to symbols
- `_intrinsic_1_descs`/`_intrinsic_2_descs` - Intrinsic function descriptors

**Key Constants:**
- `HAVE_ARGUMENT = 90` (L138) - Threshold for opcodes with arguments
- `EXTENDED_ARG = 144` (L206) - Extended argument opcode
- `MIN_PSEUDO_OPCODE = 256` (L260), `MAX_PSEUDO_OPCODE` (L280) - Pseudo opcode range

## Dependencies
- Conditionally imports `stack_effect` from `_opcode` module (L18-22) for stack depth analysis
- Exports comprehensive `__all__` list (L7-9) for public API

This module is fundamental to Python's bytecode system, used by disassemblers, optimizers, and the interpreter itself.