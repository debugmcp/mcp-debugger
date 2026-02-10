# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/newlib/generic.rs
@source-hash: 182e584f14e09849
@generated: 2026-02-09T18:03:17Z

**Primary Purpose:** Defines common C-compatible data structures used across newlib-based embedded systems and platforms, providing Rust FFI bindings for POSIX-like system types.

**Key Structures:**

- **sigset_t (L7-12):** Platform-specific signal set representation
  - Horizon OS: 16-element `c_ulong` array for extended signal handling
  - Other newlib platforms: Single `u32` for basic signal masking
  - Conditional compilation ensures correct memory layout per target

- **stat (L14-32):** File metadata structure matching POSIX stat interface
  - Standard file attributes: device, inode, mode, ownership (L15-21)
  - Size and timestamps with spare padding fields (L22-28)
  - Block-level information for filesystem optimization (L29-31)
  - Compatible with newlib's stat syscall implementation

- **dirent (L34-38):** Directory entry for filesystem traversal
  - Fixed 256-byte filename buffer typical of embedded filesystems
  - Includes inode number and file type classification

**Dependencies:**
- Imports `off_t` and prelude types from parent crate modules (L3-4)
- Uses crate-level type aliases for POSIX compatibility (e.g., `crate::dev_t`, `crate::ino_t`)

**Architectural Patterns:**
- Uses `s!` macro for C struct definition with proper memory layout
- Conditional compilation (`#[cfg]`) for platform-specific variations
- All fields are public for direct FFI access without accessor overhead

**Critical Constraints:**
- Memory layouts must exactly match corresponding C structures in newlib
- Field ordering and sizes are ABI-critical for system call compatibility
- Target-specific configurations ensure binary compatibility across newlib variants