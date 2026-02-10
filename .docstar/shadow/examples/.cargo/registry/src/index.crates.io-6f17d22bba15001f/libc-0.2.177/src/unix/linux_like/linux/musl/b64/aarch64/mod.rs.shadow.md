# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/musl/b64/aarch64/mod.rs
@source-hash: 5ba43a3198d9dff4
@generated: 2026-02-09T17:57:12Z

## AArch64 musl libc Type Definitions and Constants

**Purpose**: Provides platform-specific type definitions, structures, and constants for AArch64 architecture on Linux with musl C library. This file defines the C ABI interface layer for 64-bit ARM systems.

### Key Type Definitions (L4-8)
- `__u64`/`__s64`: 64-bit unsigned/signed integers mapped to C long long types
- `wchar_t`: Wide character type as 32-bit unsigned integer
- `nlink_t`: Number of hard links type as 32-bit unsigned integer  
- `blksize_t`: Block size type as C int

### Critical Structures

**File System Structures (L10-53)**
- `stat` (L11-31): Standard file status structure with device, inode, mode, ownership, size, timestamps
- `stat64` (L33-53): 64-bit version of stat structure (identical layout to stat on 64-bit systems)
- Both include nanosecond-precision timestamps and padding fields for alignment

**Process/Debug Structures (L55-60, L124-128)**
- `user_regs_struct` (L55-60): AArch64 register state with 31 general-purpose registers, stack pointer, program counter, processor state
- `user_fpsimd_struct` (L124-128): Floating-point/SIMD register state with 32 vector registers and control registers

**IPC Structure (L62-89)**
- `ipc_perm` (L62-89): Inter-process communication permissions with conditional compilation for musl version differences
- Contains deprecated field names for backward compatibility (L66-71, L81-86)

**Context Structures (L91-107)**
- `ucontext_t` (L91-97): User context for signal handling
- `mcontext_t` (L99-107): Machine-specific context with 16-byte alignment, fault address, registers, and reserved space

**System Call Structures (L109-122)**
- `clone_args` (L110-122): Arguments for clone3 system call with 8-byte alignment
- `max_align_t` (L132-135): Maximum alignment type with 16-byte alignment

### Constants Groups

**File Operations (L138-150)**: O_* flags for open() system call
**Error Codes (L152-234)**: Complete set of errno values for AArch64
**Hardware Capabilities (L237-268)**: HWCAP_* flags for CPU feature detection
**Memory Mapping (L270-280)**: MAP_* flags for mmap() operations
**Socket/Signal Constants (L282-311)**: Socket types, signal handling flags
**Terminal Control (L636-712)**: Comprehensive termios flags and baud rates
**System Call Numbers (L328-631)**: Complete SYS_* constants for system call interface

### Architecture-Specific Details
- All structures use natural AArch64 alignment
- System call numbers follow AArch64 Linux convention
- Hardware capability flags specific to ARM64 features (crypto, SVE, etc.)
- Terminal baud rates include high-speed options up to 4Mbps