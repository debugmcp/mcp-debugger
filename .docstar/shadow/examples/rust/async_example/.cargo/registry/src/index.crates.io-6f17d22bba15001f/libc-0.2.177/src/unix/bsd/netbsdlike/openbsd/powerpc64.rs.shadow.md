# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/netbsdlike/openbsd/powerpc64.rs
@source-hash: 1f62a42e2970c42d
@generated: 2026-02-09T17:57:12Z

**Platform-specific constants for OpenBSD PowerPC64 architecture**

This file defines low-level system constants specific to the OpenBSD operating system running on PowerPC64 architecture. It serves as part of the libc crate's platform abstraction layer.

**Key Constants:**
- `_ALIGNBYTES` (L3): Memory alignment boundary calculated as `size_of::<c_long>() - 1`, used for proper data structure alignment on PowerPC64
- `_MAX_PAGE_SHIFT` (L5): Maximum page size shift value set to 12, indicating 4KB (2^12) maximum page size

**Dependencies:**
- Uses `crate::prelude::*` (L1) for common libc types and utilities including `c_long` and `size_of`

**Architectural Context:**
This file is part of libc's hierarchical platform organization: `unix/bsd/netbsdlike/openbsd/powerpc64.rs`, providing the most specific constants for this exact platform combination. These constants are typically used by memory management and system call implementations that need platform-aware alignment and paging behavior.

**Usage Pattern:**
Values are public constants intended for consumption by other parts of the libc crate that need to perform platform-specific operations involving memory alignment and page size calculations.