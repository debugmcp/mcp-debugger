# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/musl/b32/
@generated: 2026-02-09T18:16:40Z

## Purpose and Responsibility

This directory provides comprehensive platform-specific definitions for 32-bit architectures running Linux with musl libc. It serves as the lowest-level abstraction layer in the libc crate's platform hierarchy, defining the precise binary interface between Rust programs and the Linux kernel across multiple 32-bit architectures.

The module acts as the foundational FFI (Foreign Function Interface) layer that enables Rust programs to interact with Linux system calls, C library functions, and kernel interfaces on 32-bit platforms using musl libc, ensuring proper ABI (Application Binary Interface) compatibility.

## Key Components and Architecture Support

### Multi-Architecture Platform Support
The directory supports six major 32-bit architectures through specialized modules:
- **ARM** (`arm/`): ARM 32-bit with complete register context definitions
- **x86** (`x86/`): Intel 32-bit x86 with FPU debugging support  
- **MIPS** (`mips/`): MIPS32 with architecture-specific syscall offset (4000+)
- **PowerPC** (`powerpc.rs`): PowerPC32 with platform-specific endianness handling
- **Hexagon** (`hexagon.rs`): Qualcomm Hexagon DSP processor optimizations
- **RISC-V** (`riscv32/`): RISC-V 32-bit with Y2038 time64 compatibility

### Core System Interface Layer
All architectures provide consistent interfaces for:

**System Structures**: 
- File operations (`stat`, `stat64`) with architecture-specific field ordering
- IPC mechanisms (`ipc_perm`, `shmid_ds`, `msqid_ds`) for inter-process communication
- Signal handling (`mcontext_t`, `ucontext_t`, `stack_t`) with architecture-specific register layouts
- Threading primitives (`pthread_attr_t`, `sem_t`) with platform-appropriate sizing

**Platform Constants**:
- File operation flags and memory mapping parameters
- Complete error code mappings (errno values)  
- Signal numbers and terminal control definitions
- Architecture-specific memory alignment requirements

**System Call Interface**:
- Complete syscall number mappings for each architecture
- Modern kernel feature support (io_uring, pidfd, landlock)
- Platform-specific syscall conventions and offsets

## Public API Surface

### Main Entry Points
- **`mod.rs`**: Central dispatcher that conditionally includes architecture-specific modules based on target configuration
- **Architecture Modules**: Each provides complete platform-specific type definitions, constants, and syscall numbers

### Key Exported Categories
- **Type Definitions**: Platform-specific mappings for fundamental C types (`wchar_t`, `nlink_t`, `blksize_t`)
- **System Structures**: File system, IPC, and signal handling structures with proper alignment
- **Constants**: File operations, memory management, terminal control, and error handling
- **Syscall Numbers**: Complete `SYS_*` constant sets enabling direct kernel interface access

## Internal Organization and Data Flow

### Hierarchical Structure
```
b32/ (32-bit musl base)
├── mod.rs (architecture dispatcher)
├── arm/ (ARM-specific definitions)
├── x86/ (x86-specific definitions) 
├── mips/ (MIPS-specific definitions)
├── powerpc.rs (PowerPC definitions)
├── hexagon.rs (Hexagon definitions)
└── riscv32/ (RISC-V definitions)
```

### Integration Pattern
1. **Configuration Layer**: `mod.rs` uses conditional compilation to select appropriate architecture module
2. **Platform Layer**: Each architecture module provides complete ABI-compatible definitions
3. **Interface Layer**: Higher-level libc functions consume these platform-specific definitions
4. **Application Layer**: System calls and C interop rely on precise structure layouts and constants

## Important Patterns and Conventions

### Architecture Adaptation Strategies
- **Memory Alignment**: Each platform defines appropriate alignment requirements (`max_align_t`, padding fields)
- **Syscall Conventions**: Platform-specific numbering (MIPS +4000 offset, standard Linux numbering for others)
- **Structure Layout**: Architecture-specific field ordering and padding for kernel compatibility
- **Version Compatibility**: Conditional compilation for different musl libc versions

### Safety and Compatibility Features
- **ABI Correctness**: Precise C-compatible structure layouts using libc crate macros
- **Y2038 Compliance**: Time64 syscall variants for 32-bit time_t overflow protection (especially RISC-V)
- **Forward Compatibility**: Support for recent kernel additions across all architectures
- **Defensive Programming**: Comprehensive error code coverage and proper type marshaling

This directory forms the critical foundation for all system-level operations on 32-bit musl Linux systems, providing the essential mapping between Rust's type system and various kernel binary interfaces while maintaining both safety and performance.