# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b64/x86_64/
@generated: 2026-02-09T18:16:11Z

## Overall Purpose

This directory provides x86_64-specific Linux system call bindings and low-level platform definitions for Rust's libc crate. It implements the critical interface layer between Rust applications and the GNU C library on 64-bit x86_64 Linux systems, supporting both standard x86_64 and x32 ABIs.

## Key Components and Architecture

**mod.rs** serves as the primary module containing:
- Core type definitions and structs for system programming (signal handling, file operations, process control)
- Complete x86_64 CPU context structures for debugging and signal handling
- Comprehensive constant definitions for system calls, file operations, and hardware interfaces
- Foreign function declarations for POSIX context manipulation

**ABI-Specific Modules**:
- **not_x32.rs**: Standard x86_64 ABI implementation with full 64-bit addressing
- **x32.rs**: x32 ABI variant providing 32-bit pointers with 64-bit register access

Both ABI modules provide:
- `statvfs` filesystem statistics structures
- Pthread synchronization primitive sizes and initializers  
- Complete system call number mappings (with x32 using `__X32_SYSCALL_BIT` offset)

## Public API Surface

**Primary Entry Points**:
- System data structures: `stat`, `sigaction`, `mcontext_t`, `ucontext_t`, `clone_args`
- CPU context access: `user_regs_struct`, `user_fpregs_struct` for ptrace/debugging
- IPC primitives: `ipc_perm`, `shmid_ds` for System V IPC
- Threading: `pthread_attr_t`, mutex initializers, barrier/rwlock constants

**System Call Interface**:
- Comprehensive syscall number definitions for both ABIs
- Foreign functions: `getcontext`, `setcontext`, `makecontext`, `swapcontext`, `sysctl`

**Constants by Domain**:
- File operations (`O_*`, `F_*` flags)
- Signal handling (signal numbers, `SA_*` flags)
- Memory mapping (`MAP_*` flags including x86_64-specific `MAP_32BIT`)
- Terminal I/O (termios flags, baud rates)
- Register indexing for ptrace and ucontext operations

## Internal Organization and Data Flow

The module follows a layered architecture:
1. **Type Foundation**: Basic C-compatible types and platform-specific primitives
2. **Structure Definitions**: System call interfaces using `s!` and `s_no_extra_traits!` macros
3. **Constant Definitions**: Organized by functional domain (files, signals, memory, etc.)
4. **ABI Specialization**: Conditional compilation routes to appropriate ABI-specific submodule
5. **Trait Implementations**: Custom equality and hashing that ignores padding fields

Data flows from higher-level Rust code through these bindings to invoke Linux system calls with proper ABI compliance and type safety.

## Important Patterns and Conventions

**ABI Handling**: Runtime detection of pointer width (L801-809) automatically selects between x32 and standard x86_64 implementations, ensuring correct syscall routing and structure layouts.

**Type Safety**: Uses macro-generated structs with automatic trait derivation where possible, falling back to manual implementations for complex types requiring custom equality semantics.

**Backward Compatibility**: Maintains deprecated symbols and handles glibc version dependencies, particularly around modern features like shadow stack support.

**Platform Optimization**: Tailored specifically for x86_64 GNU/Linux with glibc, including architecture-specific features like x86_64 register layouts and memory mapping flags.

This directory forms the foundational layer enabling safe, efficient system programming on x86_64 Linux platforms from Rust applications.