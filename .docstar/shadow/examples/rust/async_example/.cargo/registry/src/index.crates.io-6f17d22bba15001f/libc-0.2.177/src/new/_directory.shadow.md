# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/new/
@generated: 2026-02-09T18:16:53Z

## Overall Purpose and Responsibility

This directory implements platform-specific "new" implementations within the libc crate, providing modern Rust FFI bindings to advanced system functionality on Android and Linux platforms. It serves as a comprehensive abstraction layer for cutting-edge platform features that extend beyond traditional POSIX interfaces, with particular focus on high-performance networking, specialized protocols, and platform-optimized system calls.

## Key Components and Integration

The directory is organized into two major platform-specific modules that work together to provide comprehensive modern system interface coverage:

### Android Bionic Module (`bionic/`)
- Provides Android-specific enhancements to standard POSIX functionality
- Implements high-performance batch socket operations (`sendmmsg`/`recvmmsg`) 
- Offers advanced socket control structures for credential passing and file descriptor transfer
- Serves as the primary gateway for Android system-level networking

### Linux UAPI Module (`linux_uapi/`)
- Bridges Rust applications to Linux kernel userspace APIs (UAPI)
- Implements comprehensive CAN (Controller Area Network) protocol stack
- Provides direct access to specialized Linux kernel subsystems beyond standard libc

Both modules employ consistent architectural patterns:
- **Facade Pattern**: Root `mod.rs` files provide clean public APIs while hiding implementation complexity
- **Platform Mirroring**: Internal organization follows respective platform conventions (Android Bionic structure, Linux kernel UAPI hierarchy)
- **Layered Protocols**: Base functionality supports higher-level protocol implementations

## Public API Surface

### Primary Entry Points
- **Android Bionic Access**: `libc::new::bionic::*` for Android-specific socket enhancements
  - Batch operations: `recvmmsg`, `sendmmsg`
  - Control structures: `msghdr`, `cmsghdr`, `ucred`
  - Optimized socket functions with Android-specific performance enhancements

- **Linux UAPI Access**: `libc::new::linux_uapi::*` for kernel interface bindings  
  - CAN protocol stack: `can_frame`, `canfd_frame`, `canxl_frame`
  - Socket addressing: `sockaddr_can` and protocol constants
  - Specialized kernel subsystem interfaces

### Integration Pattern
Both modules are accessible through the `libc::new::*` namespace, providing:
```rust
// Android-specific enhancements
use libc::new::bionic::{sendmmsg, recvmmsg, msghdr};

// Linux kernel interfaces  
use libc::new::linux_uapi::{can_frame, sockaddr_can, SOL_CAN_RAW};
```

## Internal Organization and Data Flow

The directory implements a three-tier architecture:

1. **Public Interface Tier**: Root modules provide unified access patterns and hide platform complexity
2. **Platform Implementation Tier**: Actual platform-specific implementations with optimizations and extensions
3. **FFI Bridge Tier**: C-compatible structures and functions for seamless system integration

Data flows through platform-optimized paths that leverage modern system capabilities:
- **Android Path**: Enhanced socket operations for mobile/embedded performance requirements
- **Linux Path**: Direct kernel interface access for specialized protocols and hardware integration

## Important Patterns and Conventions

- **Modern System Interface Focus**: Targets advanced functionality beyond traditional POSIX, representing cutting-edge platform capabilities
- **Platform-Specific Optimization**: Each module leverages unique platform strengths (Android's Bionic optimizations, Linux's rich kernel interfaces)
- **Zero-Cost Abstraction**: Rust safety and ergonomics without sacrificing system-level performance
- **Extensible Architecture**: Clean separation allows independent evolution of platform-specific implementations
- **Comprehensive Coverage**: From high-level networking protocols to low-level kernel interfaces

This directory represents the modern evolution of system programming interfaces in Rust, providing applications with safe, performant access to cutting-edge platform functionality while maintaining the reliability and compatibility expected from the libc crate.