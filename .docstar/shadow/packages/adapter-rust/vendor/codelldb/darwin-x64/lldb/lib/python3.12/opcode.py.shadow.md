# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/opcode.py
@source-hash: 192f6008508f28d3
@generated: 2026-02-09T18:08:31Z

## Purpose
This module provides bytecode operation definitions and utilities for Python's interpreter, serving as a shared resource between disassembly tools and bytecode optimizers. It defines opcodes, their properties, and categorization systems for Python 3.12's bytecode instruction set.

## Core Data Structures

**Operation Maps and Lists (L24-49)**
- `opmap` (L45): Dictionary mapping opcode names to numeric values
- `_pseudo_ops` (L49): Maps pseudo opcodes to their real opcode equivalents
- Categorization lists: `hasarg`, `hasconst`, `hasname`, `hasjrel`, `hasjabs`, `haslocal`, `hascompare`, `hasfree`, `hasexc` (L26-34) - classify opcodes by their argument/operand types

**Comparison Operations (L24)**
- `cmp_op`: Tuple defining comparison operators (`<`, `<=`, `==`, `!=`, `>`, `>=`)

## Key Functions

**Opcode Definition Functions (L51-75)**
- `def_op(name, op)` (L51): Basic opcode registration
- `name_op(name, op)` (L54): Defines opcodes that reference names, adds to `hasname`
- `jrel_op(name, op)` (L58): Defines relative jump opcodes, adds to `hasjrel`  
- `jabs_op(name, op)` (L62): Defines absolute jump opcodes, adds to `hasjabs`
- `pseudo_op(name, op, real_ops)` (L66): Defines pseudo opcodes that map to real opcodes, with automatic list categorization

**Utility Functions**
- `is_pseudo(op)` (L39): Tests if opcode is in pseudo range (256+)
- Optional `stack_effect` imported from `_opcode` module (L18-22)

## Opcode Definitions

**Basic Operations (L80-137)**
Defines fundamental bytecode operations including stack manipulation (`POP_TOP`, `PUSH_NULL`), arithmetic (`UNARY_NEGATIVE`, `BINARY_SUBSCR`), control flow, and function returns.

**Argument-Based Operations (L138-234)**
Operations with arguments starting from `HAVE_ARGUMENT = 90`. Includes variable access (`LOAD_FAST`, `STORE_FAST`), name resolution (`LOAD_NAME`, `STORE_NAME`), jumps (`FOR_ITER`, `JUMP_FORWARD`), and function calls (`CALL`).

**Instrumented Instructions (L236-257)**
Specialized versions of standard opcodes for debugging/profiling, ranging from `MIN_INSTRUMENTED_OPCODE = 237` to 255.

**Pseudo Opcodes (L260-281)**
Compiler-only opcodes that map to real instructions, starting from `MIN_PSEUDO_OPCODE = 256`. Examples: `SETUP_FINALLY`, `JUMP`, `LOAD_METHOD`.

## Specialization System

**Binary Operations (L289-316)**
- `_nb_ops`: Maps numeric operation names to their symbols for `BINARY_OP` specialization

**Intrinsic Functions (L318-339)**
- `_intrinsic_1_descs`, `_intrinsic_2_descs`: Descriptors for intrinsic function calls

**Specialized Instructions (L341-441)**
- `_specializations`: Maps base opcodes to their optimized variants (e.g., `CALL` → `CALL_PY_EXACT_ARGS`)
- Enables performance optimizations for common patterns

**Cache Format (L443-492)**
- `_cache_format`: Defines cache entry structures for specialized opcodes
- `_inline_cache_entries`: Calculates cache sizes per opcode

## Key Constants
- `HAVE_ARGUMENT = 90` (L138): Threshold for opcodes with arguments
- `EXTENDED_ARG = 144` (L206): Opcode for extending argument range
- `ENABLE_SPECIALIZATION = True` (L37): Feature flag for opcode specialization
- Pseudo opcode range: 256 to `MAX_PSEUDO_OPCODE`

## Final Processing (L282-287)
- Cleanup of definition functions via `del` statement
- Construction of `opname` list mapping opcode numbers to names

This module serves as the authoritative source for Python bytecode instruction definitions and their metadata, essential for any tool working with Python's compiled bytecode.