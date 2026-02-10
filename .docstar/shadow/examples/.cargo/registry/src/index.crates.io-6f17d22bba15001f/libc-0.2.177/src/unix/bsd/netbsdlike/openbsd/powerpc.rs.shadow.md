# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/netbsdlike/openbsd/powerpc.rs
@source-hash: f064d935f416ca9f
@generated: 2026-02-09T18:02:09Z

**Purpose**: Platform-specific constants for PowerPC architecture on OpenBSD systems within the libc crate's Unix BSD hierarchy.

**Key Constants**:
- `_ALIGNBYTES` (L3): Memory alignment mask for PowerPC, computed as `size_of::<c_double>() - 1` (typically 7 for 8-byte alignment)
- `_MAX_PAGE_SHIFT` (L5): Maximum page size shift value set to 12, indicating 4KB page size (2^12 = 4096 bytes)

**Dependencies**:
- `crate::prelude::*` (L1): Imports common libc types including `c_double` and `size_of`

**Architecture Context**: 
This file provides PowerPC-specific low-level system constants for OpenBSD. The alignment constant ensures proper memory alignment for double-precision floating point values, while the page shift constant defines virtual memory page boundaries. These constants are used by higher-level system call wrappers and memory management functions.

**Usage Pattern**: Constants are `pub` for external crate access and `pub(crate)` for internal-only use, following libc crate's visibility conventions for platform-specific definitions.