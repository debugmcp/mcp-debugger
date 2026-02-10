# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/opcode.py
@source-hash: 192f6008508f28d3
@generated: 2026-02-09T18:13:24Z

## Purpose
Python bytecode opcode definitions and metadata management. This module serves as the central registry for Python virtual machine opcodes, their properties, and specialization information. Used by the `dis` module and other bytecode analysis tools.

## Core Data Structures

### Opcode Classification Lists (L26-34, L42-43)
- `hasarg`, `hasconst`, `hasname`, `hasjrel`, `hasjabs`, `haslocal`, `hascompare`, `hasfree`, `hasexc`: Lists categorizing opcodes by their argument types and behaviors
- `oplists` (L42-43): Aggregates all classification lists for batch operations

### Primary Mappings
- `opmap` (L45): Core dictionary mapping opcode names to numeric values
- `opname` (L284-286): Reverse mapping from opcode numbers to names
- `_pseudo_ops` (L49): Maps pseudo opcodes to their real opcode equivalents

## Key Functions

### Opcode Definition Functions (L51-75)
- `def_op(name, op)` (L51-52): Base function to register an opcode
- `name_op(name, op)` (L54-56): Registers opcodes that reference names
- `jrel_op(name, op)` (L58-60): Registers relative jump opcodes
- `jabs_op(name, op)` (L62-64): Registers absolute jump opcodes
- `pseudo_op(name, op, real_ops)` (L66-74): Registers pseudo opcodes with their real implementations

### Utility Functions
- `is_pseudo(op)` (L39-40): Checks if an opcode is a pseudo opcode
- `stack_effect` (L19-22): Conditionally imported from `_opcode` module

## Opcode Definitions

### Regular Opcodes (L80-234)
Comprehensive definition of Python 3.x bytecode instructions from basic operations (POP_TOP, PUSH_NULL) to complex constructs (CALL, MAKE_FUNCTION). Key threshold:
- `HAVE_ARGUMENT = 90` (L138): Opcodes ≥90 take arguments

### Instrumented Opcodes (L235-256)
Special debugging/profiling variants prefixed with "INSTRUMENTED_"
- Range: `MIN_INSTRUMENTED_OPCODE = 237` to opcode 255

### Pseudo Opcodes (L260-280)
Compiler-internal opcodes that map to real opcodes:
- Range: `MIN_PSEUDO_OPCODE = 256` to `MAX_PSEUDO_OPCODE` (L280)
- Examples: SETUP_FINALLY, JUMP, LOAD_METHOD

## Specialization Data

### Binary Operations (L289-316)
`_nb_ops`: Maps numeric binary operation names to their symbolic representations (e.g., "NB_ADD" → "+")

### Intrinsic Functions (L318-339)
- `_intrinsic_1_descs`: Single-argument intrinsic function names
- `_intrinsic_2_descs`: Two-argument intrinsic function names

### Opcode Specializations (L341-441)
`_specializations`: Dictionary mapping base opcodes to their specialized variants for performance optimization (adaptive interpreter)

### Cache Management (L443-493)
- `_cache_format` (L443-489): Defines cache structure for specialized opcodes
- `_inline_cache_entries` (L491-493): Calculates cache entry counts per opcode

## Constants and Globals
- `cmp_op` (L24): Tuple of comparison operators
- `ENABLE_SPECIALIZATION = True` (L37): Feature flag for opcode specialization
- `EXTENDED_ARG = 144` (L206): Special opcode for extending argument range

## Architecture Notes
- Module uses factory pattern with helper functions to build opcode registry
- Supports Python's adaptive interpreter with specialization metadata
- Handles both real and pseudo opcodes through unified interface
- Cleanup at end (L282) removes definition functions from namespace