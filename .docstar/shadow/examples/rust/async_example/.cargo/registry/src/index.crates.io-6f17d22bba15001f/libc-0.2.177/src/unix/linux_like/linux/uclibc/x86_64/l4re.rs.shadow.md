# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/uclibc/x86_64/l4re.rs
@source-hash: f29e4a969f0bf735
@generated: 2026-02-09T17:56:53Z

## Purpose
L4Re-specific type definitions and constants for x86_64 architecture under uClibc. This module provides L4Re microkernel system-specific extensions to the standard libc interface, including CPU scheduling primitives and pthread attribute structures.

## Key Types

### Core Types (L8-9)
- `l4_umword_t`: Type alias for `c_ulong`, represents an unsigned machine word in L4Re
- `pthread_t`: Standard POSIX thread handle as opaque pointer

### CPU Scheduling (L13-28)
- `l4_sched_cpu_set_t`: CPU affinity bitmap structure with granularity-based addressing
  - `gran_offset` (L25): Packed field containing 8-bit granularity (MSB) and 24-bit CPU offset (LSB)
  - `map` (L27): Bitmap representing CPU availability/affinity
  - Granularity defines how many CPUs each bit represents; offset must be power-of-2 aligned

### Thread Attributes (L30-43)
- `pthread_attr_t`: Extended pthread attributes structure including L4Re-specific fields
  - Standard POSIX fields (L31-39): detach state, scheduling policy/params, inheritance, scope, guard size, stack configuration
  - L4Re extensions (L41-42): CPU affinity set and thread creation flags

## Constants

### Stack Configuration (L48)
- `PTHREAD_STACK_MIN`: Minimum thread stack size (64KB) - higher than uClibc's 16KB due to L4Re requirements

### Signal/Terminal Constants (L51-53)
- `SIGIO`: I/O signal number (29)
- `B19200`, `B38400`: Serial baud rate constants in octal notation

## Dependencies
- Uses `crate::prelude::*` for common libc types (`c_int`, `c_uint`, `c_ulong`, `c_void`, `size_t`)
- References `super::__sched_param` from parent module
- Uses `crate::speed_t` for terminal speed definitions

## Architectural Notes
- Target-specific implementation for L4Re microkernel on x86_64/uClibc
- Extends standard POSIX pthread interface with microkernel-specific CPU affinity controls
- Uses packed bitfield encoding for efficient CPU set representation