# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/new/linux_uapi/
@generated: 2026-02-09T18:16:36Z

## Purpose

This directory provides Linux User API (UAPI) bindings for the libc crate, specifically focusing on Linux kernel userspace interfaces. It serves as a Rust FFI bridge to Linux kernel subsystems, with comprehensive support for CAN (Controller Area Network) protocol interfaces as the primary component.

## Architecture & Organization

The directory follows a hierarchical structure that mirrors the Linux kernel's `include/uapi` organization:

- **mod.rs**: Root facade module that re-exports the `linux` submodule, flattening access to nested UAPI definitions
- **linux/ subdirectory**: Contains actual Linux-specific UAPI implementations
  - Core CAN protocol bindings (`can.rs`)
  - Protocol-specific implementations (`can/raw.rs`, `can/j1939.rs`)

## Key Components Integration

### Module Aggregation Pattern
The directory uses a consistent facade pattern where `mod.rs` acts as an entry point that:
- Declares private child modules
- Provides public wildcard re-exports (`pub use linux::*`)
- Simplifies access to deeply nested kernel interface definitions

### CAN Protocol Stack
The Linux subdirectory implements a complete CAN networking stack:

1. **Base Layer**: Fundamental CAN types, frame formats, and socket addressing
2. **Raw Protocol Layer**: Direct CAN socket interface with filtering and frame format controls  
3. **Application Protocol Layer**: Higher-level protocols like J1939 for vehicle networking

## Public API Surface

### Primary Entry Points
- **CAN Frame Types**: `can_frame`, `canfd_frame`, `canxl_frame` supporting classic CAN, CAN-FD, and CAN XL protocols
- **Socket Interface**: `sockaddr_can` addressing and protocol constants (`CAN_RAW`, `CAN_BCM`, `CAN_ISOTP`, `CAN_J1939`)
- **Type Definitions**: Core CAN types (`canid_t`, `can_err_mask_t`) and J1939-specific types (`pgn_t`, `priority_t`, `name_t`)
- **Socket Configuration**: Protocol levels, option flags, and filtering capabilities

### Access Pattern
All definitions are accessible through the root module due to the re-export structure:
```rust
// Direct access to deeply nested definitions
use libc::new::linux_uapi::{can_frame, sockaddr_can, SOL_CAN_RAW};
```

## Data Flow & Integration

The directory enables a complete pathway from Rust applications to Linux kernel CAN interfaces:

1. **Application Layer**: Rust code uses type-safe bindings
2. **FFI Layer**: C-compatible structures with proper alignment (8-byte for CAN frames)
3. **Kernel Interface**: Direct mapping to Linux socket system calls and ioctl operations
4. **Hardware Layer**: Access to physical CAN bus hardware through kernel drivers

## Design Patterns

- **Kernel Mirroring**: Directory structure follows Linux kernel `include/uapi` organization for maintainability
- **C Compatibility**: All structures use C-compatible types and alignment for seamless kernel interface
- **Layered Protocols**: Raw CAN provides foundation with higher-level protocols building on top
- **Type Safety**: Rust types wrap kernel interfaces while maintaining zero-cost abstraction

This directory serves as a critical bridge enabling comprehensive CAN bus communication in Rust applications while maintaining full compatibility with existing Linux CAN infrastructure and C-based applications.