# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b64/aarch64/
@generated: 2026-02-09T18:16:15Z

## Overall Purpose and Responsibility

This directory provides comprehensive AArch64 (ARM 64-bit) architecture-specific system bindings for GNU/Linux within the libc crate. It serves as the platform-specific abstraction layer that bridges Rust code with the underlying AArch64 Linux system interface, handling both 32-bit (ILP32) and 64-bit (LP64) data models.

## Key Components and Relationships

### Core Module Structure
- **`mod.rs`**: Main module defining architecture-agnostic AArch64 types, constants, and system interfaces
- **`lp64.rs`**: LP64 data model specifics (64-bit longs/pointers) - the standard AArch64 configuration
- **`ilp32.rs`**: ILP32 data model specifics (32-bit integers/longs/pointers) - alternative AArch64 configuration

### Component Integration
The directory uses conditional compilation to select the appropriate data model:
- `mod.rs` contains shared AArch64 definitions and conditionally includes either `lp64` or `ilp32` modules
- Both data model modules provide pthread synchronization primitives with endian-aware implementations
- All components work together to provide a complete AArch64 system interface

## Public API Surface

### System Data Structures
- **File System**: `stat`, `statfs`, `statvfs` families for file metadata and filesystem information
- **Process/Thread**: `pthread_attr_t`, `ucontext_t`, `mcontext_t` for threading and signal handling
- **IPC**: `ipc_perm`, `shmid_ds` for inter-process communication
- **Signal Handling**: `sigaction`, `siginfo_t`, `stack_t` for signal management

### Architecture-Specific Constants
- **System Calls**: Complete syscall number mapping (SYS_* constants)
- **Hardware Capabilities**: HWCAP_* flags for CPU feature detection
- **Error Codes**: AArch64-specific errno definitions
- **File Operations**: O_* flags for file operations
- **Memory Management**: MAP_*, MADV_*, PROT_* flags including AArch64-specific security features (BTI/MTE)

### Pthread Synchronization Primitives
- **Structure Sizes**: `__SIZEOF_PTHREAD_*` constants for different data models
- **Mutex Initializers**: Endian-aware static initializers for recursive, error-checking, and adaptive mutexes
- **Data Model Support**: Different sizes and layouts for ILP32 vs LP64 configurations

## Internal Organization and Data Flow

### Conditional Compilation Strategy
```
mod.rs (shared AArch64 definitions)
├── cfg(target_pointer_width = "32") → ilp32.rs
└── cfg(target_pointer_width = "64") → lp64.rs
```

### Endianness Handling
Both data model modules provide endian-specific mutex initializers:
- Little endian: Type identifier at specific byte offset (12 for ILP32, 16 for LP64)
- Big endian: Type identifier at different byte offset (15 for ILP32, 19 for LP64)

### Architecture-Specific Patterns
- **Raw byte arrays**: Used for pthread mutex initializers to match C structure layout exactly
- **Alignment requirements**: Critical structures like `clone_args` and `max_align_t` specify explicit alignment
- **Hardware feature detection**: HWCAP constants enable runtime CPU capability queries

## Important Patterns and Conventions

### Type Safety
- Uses Rust type system to enforce correct sizes for pthread structures across data models
- Architecture-specific types (`wchar_t`, `nlink_t`, etc.) tailored to AArch64 requirements

### Platform Abstraction
- Provides consistent interface regardless of ILP32/LP64 data model selection
- Handles endianness differences transparently through conditional compilation

### System Integration
- Complete syscall interface covering all AArch64 Linux system calls
- Hardware capability detection for modern AArch64 features (crypto, SIMD, security extensions)
- Memory protection flags for AArch64-specific security features (Branch Target Identification, Memory Tagging Extension)

This directory represents the lowest-level system interface layer for AArch64 Linux, enabling safe and efficient system programming while abstracting away architecture-specific complexities.