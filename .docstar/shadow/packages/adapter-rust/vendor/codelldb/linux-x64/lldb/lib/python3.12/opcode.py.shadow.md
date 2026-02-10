# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/opcode.py
@source-hash: 192f6008508f28d3
@generated: 2026-02-09T18:10:00Z

This module defines Python bytecode opcodes and their metadata for the CPython 3.12 interpreter. It serves as a shared resource between `dis` and other bytecode manipulation modules.

## Core Purpose
- Maps opcode names to numeric values (L45-285)
- Categorizes opcodes by their characteristics (argument types, behaviors)
- Provides specialized instruction variants for optimization

## Key Data Structures

### Opcode Classification Lists (L26-34)
- `hasarg`: opcodes with arguments (populated L258)
- `hasconst`: reference constant pool (L27, populated at L151, L171, L227)
- `hasname`: reference name tables (L28, populated via `name_op`)
- `hasjrel/hasjabs`: relative/absolute jumps (L29-30)
- `haslocal`: local variable operations (L31)
- `hascompare`: comparison operations (L32, L159)
- `hasfree`: free variable/closure operations (L33)
- `hasexc`: exception handling related (L34)

### Core Mappings
- `opmap`: name → opcode number mapping (L45)
- `opname`: opcode number → name mapping (L284-286)
- `_pseudo_ops`: pseudo opcodes → real opcodes mapping (L49)

## Opcode Definition Functions (L51-75)

- `def_op(name, op)` (L51): Basic opcode definition
- `name_op(name, op)` (L54): Opcodes referencing name table
- `jrel_op(name, op)` (L58): Relative jump opcodes  
- `jabs_op(name, op)` (L62): Absolute jump opcodes
- `pseudo_op(name, op, real_ops)` (L66): Compiler pseudo-opcodes

## Opcode Categories

### Basic Operations (L80-137)
Standard stack operations, unary/binary ops, control flow primitives

### Argument-Required Operations (L138+)
`HAVE_ARGUMENT = 90` threshold - opcodes ≥90 take arguments

### Instrumented Operations (L236-256)
Debugging/profiling variants with `MIN_INSTRUMENTED_OPCODE = 237`

### Pseudo Operations (L260-280)  
Compiler-only opcodes mapped to real instructions, range `256-MAX_PSEUDO_OPCODE`

## Specialization Support

### Binary Operations (L289-316)
`_nb_ops`: maps numeric operations to symbols (e.g., "NB_ADD" → "+")

### Intrinsic Functions (L318-339)
- `_intrinsic_1_descs`: single-argument intrinsics
- `_intrinsic_2_descs`: dual-argument intrinsics

### Specialized Instructions (L341-441)
`_specializations`: maps base opcodes to optimized variants (e.g., `BINARY_OP` → `BINARY_OP_ADD_INT`)

### Cache Metadata (L443-492)
- `_cache_format`: defines cache entry structure per opcode
- `_inline_cache_entries`: cache size calculations for each opcode

## Key Constants
- `HAVE_ARGUMENT = 90`: argument threshold (L138)
- `EXTENDED_ARG = 144`: argument extension opcode (L206)
- `MIN_PSEUDO_OPCODE = 256`: pseudo opcode range start (L260)
- `ENABLE_SPECIALIZATION = True`: specialization flag (L37)

## Utility Functions
- `is_pseudo(op)` (L39): checks if opcode is pseudo
- Stack effect calculation via optional `_opcode.stack_effect` import (L18-22)