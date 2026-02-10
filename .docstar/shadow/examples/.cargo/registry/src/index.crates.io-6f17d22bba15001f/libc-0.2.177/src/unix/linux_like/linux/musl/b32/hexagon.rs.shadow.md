# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/musl/b32/hexagon.rs
@source-hash: 1b0c68839dc46d00
@generated: 2026-02-09T17:58:27Z

Platform-specific definitions for Hexagon architecture on 32-bit musl Linux systems. This file provides low-level C bindings and system constants tailored for Qualcomm's Hexagon DSP processor running Linux with musl libc.

## Key Type Definitions

**Basic Types (L3-4):**
- `wchar_t = u32` - Wide character type for Unicode support  
- `stat64 = crate::stat` - Alias for 64-bit file status structure

**Core Structures (L6-86):**
- `stat` (L7-28) - File metadata structure with device ID, inode, permissions, timestamps, and padding fields for 32-bit alignment
- `stack_t` (L30-34) - Signal stack descriptor with pointer, flags, and size
- `ipc_perm` (L36-52) - IPC permissions with conditional compilation for musl v1.2.3 compatibility (deprecated `__ipc_perm_key` field)
- `shmid_ds` (L54-68) - Shared memory segment descriptor with permissions, size, and process tracking
- `msqid_ds` (L70-85) - Message queue descriptor with permissions, timestamps, and queue metadata

## System Constants

**Address Family Constants (L88-91):**
- Socket family definitions (AF_FILE=1, AF_KCM=41, AF_MAX=43, AF_QIPCRTR=42)

**Error Codes (L92-172):**
- Comprehensive POSIX error constants mapped to Hexagon-specific values
- Network errors (EADDRINUSE=98, ECONNREFUSED=111)
- System errors (EDEADLK=35, ENOLCK=37)

**File Control Constants (L173-190):**
- File locking and ownership flags (F_EXLCK=4, F_OWNER_PID=1)
- Linux-specific base offset (F_LINUX_SPECIFIC_BASE=1024)

**Memory Mapping (L192-202):**
- mmap() flags including Hexagon-specific optimizations
- Special flags: MAP_UNINITIALIZED=0 (disabled for security)

**File Operations (L203-214):**
- open() flags with direct I/O and large file support
- Synchronization modes (O_SYNC=1052672)

**Signal Handling (L219-246):**
- Signal action flags and signal numbers
- Stack size constants (SIGSTKSZ=8192, MINSIGSTKSZ=2048)
- Signal mask operations

**System Calls (L258-612):**
- Comprehensive syscall number mappings for Hexagon architecture
- Mix of standard Linux syscalls and Hexagon-specific variants
- Recent additions include io_uring and pidfd operations
- Some syscalls marked as FIXME or -1 (incomplete/unsupported)

**Terminal I/O (L613-621):**
- TTY control constants and special character indices

## Architecture Notes

This file represents the intersection of:
- Qualcomm Hexagon DSP architecture (32-bit)
- musl libc implementation
- Linux kernel interface
- POSIX compliance requirements

The numerous padding fields in structures ensure proper memory alignment for the Hexagon processor's requirements. Conditional compilation handles musl version differences, particularly around IPC permission structures.