# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/musl/b64/aarch64/mod.rs
@source-hash: 5ba43a3198d9dff4
@generated: 2026-02-09T17:57:06Z

## Purpose
Architecture-specific definitions for AArch64 (ARM64) Linux systems using musl libc. Provides low-level system types, structures, constants, and system call numbers for 64-bit ARM architecture on Linux with musl C library.

## Key Components

### Type Definitions (L4-8)
- `__u64`/`__s64`: 64-bit unsigned/signed integers mapped to C long types
- `wchar_t` (L6): Wide character type as 32-bit unsigned integer
- `nlink_t` (L7): File link count type as 32-bit unsigned integer  
- `blksize_t` (L8): Block size type as C int

### Critical Structures

#### File System Structures (L10-53)
- `stat` (L11-31): Standard file status structure with device, inode, mode, ownership, size, timestamps
- `stat64` (L33-53): 64-bit version of stat structure (identical layout on this architecture)
- Both include nanosecond-precision timestamps and padding fields for ABI compatibility

#### Process/Thread Context (L55-128)
- `user_regs_struct` (L55-60): ARM64 register set with 31 general-purpose registers, stack pointer, program counter, processor state
- `ucontext_t` (L91-97): User context for signal handling
- `mcontext_t` (L99-107): Machine context with 16-byte alignment, fault address, registers, and reserved space
- `user_fpsimd_struct` (L124-128): Floating-point/SIMD register state with 32 128-bit vector registers

#### IPC Structure (L62-89)
- `ipc_perm` (L62-89): IPC permissions with conditional compilation for musl version differences
- Contains deprecated field naming with version-specific corrections

#### System Call Support (L110-122, L133-136)
- `clone_args` (L110-122): Arguments for clone3 system call with 8-byte alignment
- `max_align_t` (L133-136): Maximum alignment type with 16-byte alignment

### Constants Categories

#### File Operations (L138-150)
File opening flags including O_APPEND, O_DIRECT, O_LARGEFILE, etc.

#### Error Codes (L152-234) 
Comprehensive errno values from ENAMETOOLONG through EHWPOISON

#### Hardware Capabilities (L237-268)
HWCAP_* flags for ARM64 CPU features like floating-point, crypto, SVE

#### Memory Management (L270-280)
Memory mapping flags including MAP_ANON, MAP_HUGETLB, MAP_SYNC

#### Signal Handling (L285-311)
Signal numbers, stack flags, and signal mask operations

#### System Calls (L328-631)
Complete system call number definitions from SYS_io_setup (0) through SYS_mseal (462)

#### Terminal I/O (L636-712)
Termios flags for baud rates, character sizes, flow control, and line discipline

## Architecture-Specific Notes
- AArch64-specific register layout in user_regs_struct
- 16-byte alignment requirements for mcontext_t and max_align_t  
- ARM64-specific hardware capability flags
- System call numbers follow ARM64 Linux ABI

## Dependencies
Imports `off_t` from parent module and uses crate prelude for common C types. Relies on musl libc version detection for conditional compilation.