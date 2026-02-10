# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/musl/b32/x86/mod.rs
@source-hash: 264aafdd2d3dbbf5
@generated: 2026-02-09T17:57:05Z

**Purpose**: Provides low-level system type definitions, constants, and structures for 32-bit x86 Linux systems using musl C library. Part of the libc crate's platform-specific type system.

**Architecture**: x86 32-bit specific definitions for musl Linux, focusing on system calls, file operations, terminal control, memory management, and signal handling.

**Key Components**:

- **Basic Types** (L4): `wchar_t` as `i32` for wide character representation
- **File System Structures** (L7-49): `stat` and `stat64` structs with identical layouts containing file metadata (device, inode, mode, ownership, timestamps, size)
- **System Context Structures** (L51-59): 
  - `mcontext_t` (L51): Opaque machine context with 22 u32 fields
  - `stack_t` (L55): Signal stack descriptor with pointer, flags, and size
- **IPC Structures** (L61-112):
  - `ipc_perm` (L61): IPC permission structure with conditional field naming based on musl version
  - `shmid_ds` (L81): Shared memory segment descriptor  
  - `msqid_ds` (L97): Message queue descriptor
- **Extended Structures** (L115-145): Floating point and context structures without standard traits:
  - `user_fpxregs_struct` (L116): x86 FPU/SSE register state
  - `ucontext_t` (L132): User context for signal handling
  - `max_align_t` (L142): Maximum alignment type (8-byte aligned)

**Trait Implementations** (L147-215): Conditional `PartialEq`, `Eq`, and `Hash` implementations for extended structures when "extra_traits" feature is enabled. Deliberately ignores padding and reserved fields.

**Constants**:
- **Signal/Stack** (L217-218): Stack size constants (`SIGSTKSZ`, `MINSIGSTKSZ`)
- **File Operations** (L220-304): File flags, memory mapping, socket types, error codes
- **Terminal Control** (L226-295): Comprehensive termios flags, baud rates, control characters
- **System Calls** (L460-870): Complete x86-32 Linux syscall number definitions
- **Register Offsets** (L873-889): x86 register positions in ptrace user_regs_struct

**Dependencies**: 
- Internal crate types (`off_t`, `dev_t`, `mode_t`, etc.)
- Standard prelude for common types
- `cfg_if` macro for conditional compilation
- Hash trait from std::hash when extra_traits enabled

**Architecture Notes**:
- Handles musl version differences in `ipc_perm` field naming (L62-70)
- Includes deprecated syscall constants for kernel compatibility (L587-630)
- x86-specific register mappings for debugging/tracing (L873-889)
- 32-bit specific structure layouts and padding