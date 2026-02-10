# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/android/b32/
@generated: 2026-02-09T18:16:40Z

## Android 32-bit Architecture Platform Abstraction Layer

This directory provides the complete platform-specific implementation for Android running on 32-bit architectures (ARM and x86) within the libc crate's hierarchical platform abstraction system. It serves as the lowest-level platform definition layer in the unix/linux_like/android hierarchy, bridging Rust code with underlying Android system interfaces.

## Overall Purpose and Responsibility

The module establishes a unified 32-bit Android platform interface while accommodating architecture-specific differences. It provides:
- Common 32-bit Android type definitions and ABI compatibility
- Architecture-specific implementations for ARM and x86 processors
- Complete syscall interfaces with numeric kernel mappings
- Signal handling and context switching infrastructure
- Memory management, threading, and file operation constants
- Android-specific workarounds for platform limitations

## Key Components and Architecture

**Common Foundation (mod.rs)**
- Shared 32-bit type definitions: `mode_t`, `off64_t`, `sigset_t`, `time64_t`
- Universal structures: `sigaction`, `stat/stat64`, `pthread_*`, `sysinfo`
- Threading primitives: mutexes, condition variables, read-write locks, barriers
- Filesystem metadata and statistics structures
- Architecture dispatch logic routing to ARM or x86 implementations

**Architecture-Specific Implementations**
- **ARM Module (arm.rs)**: ARM-specific register contexts, signal handling, and syscall mappings with ARM-specific entries like `SYS_arm_fadvise64_64`
- **x86 Module (x86/)**: Complete x86 implementation with floating-point state management, 80-bit register representation, and x86-specific syscalls

**Signal Handling Infrastructure**
- Machine context structures (`mcontext_t`, `sigcontext`) for low-level register access
- User context (`ucontext_t`) providing complete signal handling state
- Android-specific padding handling for signal mask compatibility across architectures
- Architecture-specific register layouts and floating-point state preservation

## Public API Surface

**Primary Entry Points:**
- **Type System**: Platform-specific type aliases (`wchar_t`, `greg_t`, `mode_t`, `socklen_t`)
- **System Structures**: File metadata (`stat64`), threading (`pthread_*`), system info (`sysinfo`)
- **Signal Interface**: Context structures (`ucontext_t`, `mcontext_t`) for signal handling
- **Syscall Constants**: Architecture-specific `SYS_*` numeric mappings (400+ syscalls)
- **File Operations**: Platform flags (`O_DIRECT`, `O_LARGEFILE`, `MAP_32BIT`)
- **Register Access**: Debug/ptrace register offsets (`REG_*`, user register mappings)

**Compatibility Functions:**
- `accept4()`: Direct syscall implementation for Android < 5.0 compatibility
- `timegm64()`: 64-bit time conversion function

## Internal Organization and Data Flow

**Hierarchical Specialization Pattern:**
```
android/b32 (this directory) 
  ├── mod.rs (common 32-bit definitions)
  ├── arm.rs (ARM-specific implementation)  
  └── x86/ (x86-specific implementation)
```

**Integration Flow:**
1. **Common Layer**: `mod.rs` provides shared 32-bit Android definitions and architecture dispatch
2. **Architecture Layer**: ARM/x86 modules provide processor-specific implementations
3. **Syscall Interface**: Architecture modules map Rust code to kernel via numeric syscall constants
4. **Signal Handling**: Unified signal structures route to architecture-specific register contexts

## Important Patterns and Conventions

**Android Compatibility Strategy:**
- Explicit padding in signal structures accommodating Android's reduced `sigset_t` size
- Direct syscall implementations bypassing missing libc functions in older Android versions
- Conditional trait implementations respecting padding fields in equality comparisons

**Architecture Abstraction:**
- Common interface in `mod.rs` with `cfg_if!` macro dispatching to architecture-specific implementations
- Unified signal handling interface with architecture-specific register context implementations
- Consistent syscall numbering schemes adapted per architecture

**ABI Compliance:**
- Structure layouts matching native Android ABI requirements
- Proper memory alignment for 32-bit architectures
- Compatible type sizes and representations for C interoperability

This directory represents a critical abstraction layer in the libc crate, providing the concrete 32-bit Android implementations that higher-level unix/linux_like modules depend upon, while maintaining clean separation between common Android patterns and architecture-specific requirements.