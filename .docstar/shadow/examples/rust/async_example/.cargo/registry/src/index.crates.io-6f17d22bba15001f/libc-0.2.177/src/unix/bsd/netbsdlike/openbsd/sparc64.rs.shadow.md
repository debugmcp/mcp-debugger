# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/netbsdlike/openbsd/sparc64.rs
@source-hash: 8d4c5a4cae63e09e
@generated: 2026-02-09T17:57:10Z

**Purpose**: Platform-specific constants for OpenBSD on SPARC64 architecture within the libc crate's Unix BSD hierarchy.

**Key Constants**:
- `_ALIGNBYTES` (L2): Memory alignment boundary mask (0xf = 15, indicating 16-byte alignment)
- `_MAX_PAGE_SHIFT` (L4): Maximum page size shift value (13 = 8KB pages, 2^13)

**Architecture Context**: SPARC64-specific values that override or supplement generic OpenBSD definitions. These constants are typically used by memory management and system call implementations.

**Dependencies**: Part of libc's hierarchical platform abstraction (`unix::bsd::netbsdlike::openbsd::sparc64`).

**Usage Pattern**: Low-level system constants consumed by higher-level memory allocation and page management code.