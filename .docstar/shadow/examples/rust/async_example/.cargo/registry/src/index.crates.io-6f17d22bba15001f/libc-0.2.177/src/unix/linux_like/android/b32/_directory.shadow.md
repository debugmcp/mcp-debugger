# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/android/b32/
@generated: 2026-02-09T18:16:28Z

## Android 32-bit Platform Bindings

This directory provides comprehensive low-level platform bindings for Android systems running on 32-bit architectures (ARM and x86), serving as a critical component of the libc crate's cross-platform system interface layer.

### Overall Purpose and Responsibility

This module defines the complete set of C-compatible types, structures, constants, and system call interfaces needed for Rust programs to interact with the Android kernel on 32-bit systems. It handles the intricate details of Android's platform-specific variations from standard Linux, including architectural quirks, API level compatibility issues, and the transition between 32-bit and 64-bit support.

### Key Components and Architecture

**Core Foundation (`mod.rs`)**:
- Defines fundamental Android-specific C types (`mode_t`, `off64_t`, `sigset_t`, `time64_t`)
- Provides essential system structures (stat, pthread primitives, sysinfo)
- Establishes threading infrastructure with proper alignment and initialization
- Handles mixed 32/64-bit type definitions reflecting Android's evolution

**Architecture-Specific Implementations**:
- **ARM Module (`arm.rs`)**: Complete ARM 32-bit register contexts, signal handling structures, and ARM-specific system call mappings
- **x86 Module (`x86/`)**: Comprehensive x86 32-bit bindings including FPU state, register offsets, and x86-specific syscall interfaces

**Platform Adaptation Layer**:
- Android-specific workarounds (custom `accept4` implementations for API level < 21)
- Non-standard signal mask handling with explicit padding structures
- Socket operation multiplexing through socketcall interface

### Public API Surface

**Primary Entry Points**:
- Platform-specific C type definitions (`wchar_t`, `greg_t`, `mcontext_t`)
- Complete system call number mappings (SYS_* constants) for both ARM and x86
- File system operation flags and memory mapping constants
- Threading primitives with proper static initializers
- Signal handling structures with Android-specific extensions
- Register offset constants for debugging and ptrace operations

**Architecture-Specific APIs**:
- ARM: sigcontext register layout, ARM register indices (REG_R0-R15)
- x86: FPU state structures, x86 register offsets, socketcall multiplexing

### Internal Organization and Data Flow

The module follows a hierarchical organization:
1. **Common Layer (`mod.rs`)**: Shared 32-bit Android types and structures
2. **Architecture Layer**: ARM and x86-specific implementations with conditional compilation
3. **Compatibility Layer**: Android API level workarounds and non-standard extensions
4. **System Interface**: Direct kernel interaction through properly mapped system calls

Data flows from high-level Rust code through these type-safe bindings to the Android kernel, with architecture-specific paths handling register contexts, signal delivery, and system call invocation.

### Important Patterns and Conventions

**Android-Specific Adaptations**:
- Handles Android's deviations from standard Linux (signal mask sizes, syscall availability)
- Provides API level compatibility through conditional function implementations
- Manages the 32/64-bit transition with explicit 64-bit variants (stat64, rlimit64)

**Cross-Architecture Compatibility**:
- Conditional compilation ensures proper architecture selection
- Shared interfaces in mod.rs with architecture-specific implementations
- Consistent register and context handling patterns across ARM and x86

**Memory Safety and ABI Compliance**:
- Maintains strict C ABI compatibility with proper structure alignment
- Conditional trait implementations that respect padding fields in equality operations
- Architecture-aware register layouts for debugging and signal handling

This directory serves as the essential bridge between Rust's type system and Android's 32-bit kernel interfaces, enabling portable systems programming while handling the complexities of multiple architectures and Android's platform-specific requirements.