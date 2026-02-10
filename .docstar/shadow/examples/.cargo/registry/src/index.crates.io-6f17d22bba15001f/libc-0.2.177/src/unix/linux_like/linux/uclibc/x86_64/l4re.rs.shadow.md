# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/uclibc/x86_64/l4re.rs
@source-hash: f29e4a969f0bf735
@generated: 2026-02-09T17:58:16Z

## Primary Purpose
Platform-specific libc definitions for L4Re (L4 Runtime Environment) on x86_64 architecture using uClibc. Provides L4Re-specific types, structures, and constants that extend standard libc functionality.

## Key Type Definitions
- `l4_umword_t` (L8): Alias for `c_ulong`, represents unsigned machine word in L4Re
- `pthread_t` (L9): Standard pthread handle as mutable void pointer

## Core Structures

### l4_sched_cpu_set_t (L13-28)
CPU scheduling set structure for L4Re's scheduler:
- `gran_offset` (L25): Encodes both CPU granularity (8-bit MSB) and offset (24-bit LSB)
- `map` (L27): Bitmap representing available CPUs
- Critical constraint: offset must be multiple of 2^granularity

### pthread_attr_t (L30-43)
Extended pthread attributes structure combining standard POSIX fields with L4Re extensions:
- Standard fields (L31-39): detach state, scheduling policy/params, inheritance, scope, guard size, stack attributes
- L4Re extensions (L41-42): CPU affinity via `l4_sched_cpu_set_t` and creation flags
- Notable: `__stackaddr` marked with warning comment about usage (L38)

## Platform Constants
- `PTHREAD_STACK_MIN` (L48): 64KB minimum stack size (L4Re requirement, overrides uClibc's 16KB)
- `SIGIO` (L51): Signal I/O constant set to 29
- Baud rate constants (L52-53): B19200 and B38400 for serial communication

## Dependencies
- Uses `crate::prelude::*` for common libc types
- References `super::__sched_param` from parent module
- Imports `crate::speed_t` for baud rate definitions

## Architectural Notes
- Bridges gap between standard libc and L4Re microkernel requirements
- Extends standard pthread functionality with L4Re-specific CPU affinity and creation flags
- Enforces L4Re's stricter stack size requirements over uClibc defaults