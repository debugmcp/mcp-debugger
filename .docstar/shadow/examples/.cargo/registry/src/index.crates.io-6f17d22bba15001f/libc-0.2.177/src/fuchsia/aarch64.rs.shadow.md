# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/fuchsia/aarch64.rs
@source-hash: 9cd032304a54321a
@generated: 2026-02-09T18:06:18Z

**Primary Purpose:** Fuchsia OS aarch64 (ARM64) architecture-specific type definitions and data structures for the libc crate. Provides platform-specific implementations of POSIX system structures and constants.

**Key Type Definitions:**
- `__u64` (L4): Platform-specific 64-bit unsigned integer alias to `c_ulonglong`
- `wchar_t` (L5): Wide character type defined as `u32` (32-bit Unicode)
- `nlink_t` (L6): Hard link count type as `c_ulong`
- `blksize_t` (L7): Block size type as `c_long`

**Core Structures:**
- `stat` (L10-30): Standard file metadata structure with device, inode, permissions, ownership, size, timestamps, and block information. Contains padding fields `__pad0`, `__pad1`, and `__unused` for ABI alignment.
- `stat64` (L32-52): 64-bit variant of stat structure with identical layout to `stat` - appears to be duplicate definition for this architecture
- `ipc_perm` (L54-64): Inter-process communication permissions structure with key, user/group IDs, mode, and sequence number. Includes unused padding fields for alignment.

**Platform Constants:**
- `MINSIGSTKSZ` (L68): Minimum signal stack size of 6144 bytes
- `SIGSTKSZ` (L68): Default signal stack size of 12288 bytes

**Dependencies:**
- Imports `off_t` and common prelude types from parent crate modules
- References various crate-level types (`dev_t`, `ino_t`, `mode_t`, etc.)

**Architecture Notes:**
- Fuchsia-specific aarch64 implementation with Google Fuchsia source reference (L67)
- Uses musl libc signal definitions
- ABI padding ensures proper struct alignment for ARM64 architecture