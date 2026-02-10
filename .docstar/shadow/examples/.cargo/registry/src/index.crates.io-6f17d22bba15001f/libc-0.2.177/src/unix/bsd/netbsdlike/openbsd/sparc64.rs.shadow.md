# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/netbsdlike/openbsd/sparc64.rs
@source-hash: 8d4c5a4cae63e09e
@generated: 2026-02-09T18:02:06Z

**Purpose**: Platform-specific constants for OpenBSD on SPARC64 architecture, defining memory alignment and page size parameters for the libc FFI layer.

**Key Constants**:
- `_ALIGNBYTES` (L2): Hidden alignment boundary constant set to 0xf (15 bytes), used for memory alignment calculations on SPARC64
- `_MAX_PAGE_SHIFT` (L4): Maximum page shift value of 13, indicating largest supported page size of 2^13 = 8192 bytes

**Architecture Context**: This file is part of the libc crate's BSD Unix variant hierarchy, specifically targeting OpenBSD on SPARC64 processors. These constants are likely consumed by higher-level memory management and system call interfaces.

**Dependencies**: Part of the nested module structure `unix::bsd::netbsdlike::openbsd::sparc64`, inheriting from broader BSD and Unix compatibility layers.