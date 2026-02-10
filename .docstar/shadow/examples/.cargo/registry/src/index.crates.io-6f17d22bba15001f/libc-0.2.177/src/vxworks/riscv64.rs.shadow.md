# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/vxworks/riscv64.rs
@source-hash: b1f933205800f0da
@generated: 2026-02-09T18:06:17Z

**Purpose:** Platform-specific type definitions for RISC-V 64-bit architecture on VxWorks operating system within the libc crate.

**Key Definitions:**
- `wchar_t` (L1): Wide character type alias defined as 32-bit signed integer (`i32`). This follows VxWorks RISC-V 64-bit ABI conventions where wide characters are represented as 32-bit signed values.

**Architecture Context:**
This file is part of the libc crate's platform-specific type system, providing VxWorks RISC-V 64-bit specific implementations that override or supplement the generic POSIX definitions. The `wchar_t` definition ensures compatibility with VxWorks system libraries and C runtime expectations on this target platform.

**Dependencies:**
- Part of the libc crate's hierarchical type definition system
- Likely included conditionally based on target architecture and OS detection
- No explicit imports in this minimal definition file

**Critical Notes:**
- Single type definition file - extremely focused scope
- The `i32` choice for `wchar_t` is architecture and OS specific; other platforms may use different sizes
- This definition would be used by FFI code interfacing with VxWorks system calls and libraries