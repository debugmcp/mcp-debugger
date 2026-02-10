# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/musl/b32/powerpc.rs
@source-hash: 92089167ddbe1fde
@generated: 2026-02-09T17:58:22Z

**Purpose:** Platform-specific definitions for 32-bit PowerPC Linux systems using musl libc. This file provides low-level system interface constants, data structures, and syscall numbers tailored for PowerPC32/musl configuration.

**Key Components:**

### Type Definitions
- `wchar_t` (L4): 32-bit signed integer for wide character representation

### Core System Structures
- `termios` (L7-16): Terminal I/O control structure with control flags, character map, line discipline, and speed settings
- `stat` (L18-37): File status information with device, inode, permissions, ownership, size, timestamps with nanosecond precision 
- `stat64` (L39-58): 64-bit version of stat structure (identical layout to stat on this platform)
- `stack_t` (L60-64): Signal stack configuration with pointer, flags, and size
- `ipc_perm` (L66-85): IPC permissions structure with conditional field naming based on musl version (L67-75)
- `shmid_ds` (L87-102): Shared memory segment descriptor with permissions, timestamps, size, and process IDs
- `msqid_ds` (L104-119): Message queue descriptor with permissions, timestamps, and queue parameters

### Constants Categories

**Memory Management** (L122-134):
- Memory advice, signal stack sizes, memory locking flags

**File Operations** (L126-209):
- File open flags (O_DIRECT, O_DIRECTORY, etc.)
- File synchronization modes

**Memory Mapping** (L211-221):
- Memory mapping flags specific to PowerPC

**Process Tracing** (L223-224):
- PTRACE system emulation constants

**Socket Types** (L226-227):
- Basic socket type definitions

**Error Codes** (L229-313):
- Comprehensive POSIX and Linux-specific error number definitions

**Signal Handling** (L315-342):
- Signal action flags, signal numbers, and signal mask operations

**Terminal Control** (L343-361):
- Extended terminal processing flags and polling constants

**System Call Numbers** (L363-766):
- Complete PowerPC32 syscall table mapping from SYS_restart_syscall (0) to SYS_mseal (462)
- Includes deprecated syscalls with version annotations (L490-495, L531-532)

**Architecture Notes:**
- PowerPC-specific syscalls like SYS_switch_endian (L727)
- Platform-specific memory mapping and file operation flags
- Terminal control constants use octal notation for traditional Unix compatibility

**Dependencies:**
- Imports `off_t` and prelude from parent crate modules
- References crate-level type definitions (tcflag_t, dev_t, etc.)
- Conditionally compiled fields based on musl version flags