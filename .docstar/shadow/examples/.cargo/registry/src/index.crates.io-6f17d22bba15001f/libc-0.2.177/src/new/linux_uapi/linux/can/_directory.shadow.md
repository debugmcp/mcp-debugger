# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/new/linux_uapi/linux/can/
@generated: 2026-02-09T18:16:10Z

## Purpose and Responsibility

This directory provides Linux UAPI (User API) bindings for CAN (Controller Area Network) protocol implementations, offering Rust FFI interfaces to the Linux kernel's CAN socket subsystem. It enables userspace applications to communicate over CAN networks using raw sockets and higher-level protocols like SAE J1939.

## Key Components and Organization

**Raw CAN Interface (`raw.rs`)**:
- Core CAN raw socket constants and configuration options
- Socket level definitions (`SOL_CAN_RAW`) for raw CAN communications
- Filter management with support for up to 512 simultaneous filters
- Frame format support (standard CAN, CAN-FD, CAN-XL)
- Loopback and error handling configuration

**J1939 Protocol Support (`j1939.rs`)**:
- SAE J1939 protocol bindings for automotive/heavy vehicle applications
- Address management and Parameter Group Number (PGN) handling
- Device naming and network addressing schemes
- Protocol-specific socket options and control messages
- Error event handling and diagnostic capabilities

## Public API Surface

**Constants and Types**:
- Socket option levels: `SOL_CAN_RAW`, `SOL_CAN_J1939`
- Configuration constants: `CAN_RAW_*`, `J1939_*` families
- Type aliases: `pgn_t`, `priority_t`, `name_t` for J1939 semantics
- Address and PGN constants for J1939 network management

**Core Structures**:
- `j1939_filter`: Message filtering configuration for J1939 protocols

## Internal Organization and Data Flow

Both modules follow the standard Linux UAPI pattern:
1. Re-export base CAN definitions from `crate::linux::can::*`
2. Define protocol-specific constants using sequential integer enumeration
3. Provide C-compatible type definitions for kernel interface compatibility
4. Group related constants by functionality (filtering, addressing, error handling)

The modules work together to provide a layered approach:
- `raw.rs` provides the fundamental CAN socket interface
- `j1939.rs` builds upon the raw interface to support higher-level automotive protocols

## Important Patterns and Conventions

- **Constant Naming**: Follows Linux kernel conventions with module prefixes (`CAN_RAW_*`, `J1939_*`)
- **Type Safety**: Uses C primitive types (`c_int`, `c_uint`, etc.) for ABI compatibility
- **Hierarchical Organization**: Socket options use sequential numbering within protocol families
- **Re-export Strategy**: Leverages base CAN definitions to avoid duplication and maintain consistency

This directory serves as the foundation for CAN network programming in Rust applications targeting Linux systems, providing both low-level raw access and higher-level protocol support for automotive and industrial applications.