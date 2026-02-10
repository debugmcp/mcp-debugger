# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/new/linux_uapi/
@generated: 2026-02-09T18:16:41Z

## Purpose and Responsibility

This directory provides comprehensive Linux UAPI (User API) bindings for CAN (Controller Area Network) protocol implementations in the libc crate. It serves as the Rust FFI interface to the Linux kernel's CAN socket subsystem, enabling userspace applications to communicate over CAN networks using both raw sockets and higher-level automotive protocols.

## Key Components and Integration

The directory contains a single `linux` subdirectory that provides a layered approach to CAN networking through two complementary modules:

**Raw CAN Interface**: 
- Fundamental CAN raw socket constants and configuration options
- Core socket level definitions (`SOL_CAN_RAW`) for direct CAN communications
- Comprehensive filter management supporting up to 512 simultaneous filters
- Multi-format frame support (standard CAN, CAN-FD, CAN-XL)
- Essential loopback and error handling configuration primitives

**J1939 Protocol Support**:
- SAE J1939 protocol bindings for automotive and heavy vehicle applications
- Advanced address management and Parameter Group Number (PGN) handling
- Complete device naming and network addressing schemes
- Protocol-specific socket options and control message infrastructure
- Sophisticated error event handling and diagnostic capabilities

These modules work synergistically, with the J1939 implementation building upon the raw CAN foundation to provide higher-level automotive protocol support.

## Public API Surface

**Primary Entry Points**:
- Socket option levels: `SOL_CAN_RAW`, `SOL_CAN_J1939` for protocol selection
- Configuration constant families: `CAN_RAW_*` for raw operations, `J1939_*` for automotive protocols
- Specialized type aliases: `pgn_t`, `priority_t`, `name_t` providing J1939-specific semantics
- Network management constants for J1939 addressing and PGN resolution

**Core Data Structures**:
- `j1939_filter`: Advanced message filtering configuration for automotive protocols
- Re-exported base CAN definitions from `crate::linux::can::*` for foundational types

## Internal Organization and Data Flow

The directory follows a hierarchical structure where raw CAN provides the foundational socket interface, while J1939 extends this with automotive-specific protocol handling and network management features. Both modules adhere to consistent Linux UAPI patterns:

1. **Inheritance Model**: Re-export base CAN definitions to maintain consistency and avoid duplication
2. **Sequential Enumeration**: Protocol-specific constants use systematic integer sequences for kernel compatibility
3. **ABI Compatibility**: C-compatible type definitions ensure seamless kernel interface integration
4. **Functional Grouping**: Related constants organized by capability (filtering, addressing, diagnostics)

## Important Patterns and Conventions

- **Naming Consistency**: Strict adherence to Linux kernel conventions with appropriate module prefixes
- **Type Safety**: Exclusive use of C primitive types (`c_int`, `c_uint`) for cross-language ABI compatibility
- **Layered Architecture**: Clear separation between raw CAN operations and higher-level protocol implementations
- **Standards Compliance**: Full alignment with both Linux UAPI specifications and automotive industry standards (SAE J1939)

This directory serves as the authoritative foundation for CAN network programming in Rust applications on Linux systems, providing a complete spectrum from low-level raw socket access to sophisticated automotive protocol implementations suitable for industrial and vehicular applications.