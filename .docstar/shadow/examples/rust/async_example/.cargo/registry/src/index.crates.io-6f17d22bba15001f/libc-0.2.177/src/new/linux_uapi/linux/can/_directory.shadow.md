# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/new/linux_uapi/linux/can/
@generated: 2026-02-09T18:16:04Z

## Overview

This directory provides Rust FFI bindings for Linux CAN (Controller Area Network) protocol interfaces, specifically exposing kernel UAPI constants and structures from the `linux/can/` headers. It serves as the low-level foundation for CAN socket programming in Rust on Linux systems.

## Key Components

**raw.rs** - Core CAN raw socket interface
- Defines fundamental CAN raw protocol constants (`SOL_CAN_RAW`, socket options)
- Provides filtering, loopback, and frame format control options
- Supports standard CAN, CAN FD (Flexible Data-Rate), and CAN XL frames
- Maximum of 512 filters per socket (`CAN_RAW_FILTER_MAX`)

**j1939.rs** - J1939 vehicle networking protocol layer  
- Higher-level CAN protocol for heavy-duty vehicles and industrial applications
- Defines addressing scheme (unicast, idle, unassigned addresses)
- Parameter Group Number (PGN) constants for message classification
- Socket options for filtering, priority, and error handling
- Netlink attributes and error queue management
- Core `j1939_filter` struct for message filtering

## Public API Surface

**Entry Points:**
- Socket level constants: `SOL_CAN_RAW`, `SOL_J1939`
- Socket option constants for `setsockopt()`/`getsockopt()` calls
- Protocol-specific filtering and addressing constants
- Type aliases: `pgn_t`, `priority_t`, `name_t` (J1939)

**Core Data Structures:**
- `j1939_filter` - Message filtering criteria with name, PGN, and address fields

## Internal Organization

Both modules follow the same pattern:
1. Re-export base CAN types from `crate::linux::can`
2. Define protocol-specific constants as `pub c_int` values
3. Provide socket option constants for runtime configuration
4. Use C-compatible types for kernel interface compatibility

## Data Flow

The modules support a layered approach:
- **raw.rs** provides the fundamental CAN socket interface
- **j1939.rs** builds upon the raw CAN layer to implement vehicle-specific networking
- Both expose constants used with standard Linux socket system calls
- Error handling flows through dedicated error queue mechanisms

## Important Patterns

- All constants are `pub` for external consumption
- Uses `SOL_CAN_BASE + protocol_id` pattern for socket levels
- Maximum limits defined for filtering operations (512 filters)
- Consistent C integer type usage for kernel API compatibility
- Separation of concerns: raw CAN vs. application-layer protocol (J1939)