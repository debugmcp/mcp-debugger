# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/new/linux_uapi/linux/
@generated: 2026-02-09T18:16:18Z

## Purpose

This directory provides comprehensive Rust FFI bindings for Linux CAN (Controller Area Network) protocol interfaces, mapping Linux kernel UAPI headers to enable CAN socket programming in Rust applications. It serves as the foundational layer between Rust applications and the Linux kernel's CAN subsystem.

## Key Components and Organization

### Module Structure
- **mod.rs**: Entry point that declares and re-exports the `can` submodule, following standard Rust module aggregation patterns
- **can.rs**: Core CAN protocol definitions including frame structures, constants, and socket addressing
- **can/ subdirectory**: Protocol-specific implementations
  - **raw.rs**: Low-level CAN raw socket interface with filtering and frame format controls
  - **j1939.rs**: Higher-level J1939 vehicle networking protocol built on CAN

### Frame Type Hierarchy
The module supports three generations of CAN protocols:
1. **Classic CAN**: Standard 8-byte frames (`can_frame`)
2. **CAN-FD**: Flexible data-rate frames up to 64 bytes (`canfd_frame`) 
3. **CAN XL**: Extended frames up to 2048 bytes (`canxl_frame`)

All frame structures use 8-byte alignment for efficient memory access and kernel compatibility.

## Public API Surface

### Primary Entry Points
- **Frame Structures**: `can_frame`, `canfd_frame`, `canxl_frame` for different CAN variants
- **Socket Addressing**: `sockaddr_can` with protocol-specific union fields
- **Type Definitions**: `canid_t`, `can_err_mask_t`, and J1939 types (`pgn_t`, `priority_t`, `name_t`)
- **Protocol Constants**: Socket levels (`SOL_CAN_RAW`, `SOL_J1939`) and option flags

### Socket Programming Interface
- CAN ID flags and masks for standard/extended frame identification
- Socket options for filtering, loopback control, and error handling
- Protocol identifiers: `CAN_RAW`, `CAN_BCM`, `CAN_ISOTP`, `CAN_J1939`
- Maximum filter limits (512 per socket) and data length constants

## Internal Data Flow

The architecture follows a layered approach:

1. **Base Layer** (`can.rs`): Defines fundamental CAN types, frame formats, and addressing
2. **Raw Protocol** (`can/raw.rs`): Provides direct CAN socket interface with filtering capabilities  
3. **Application Protocol** (`can/j1939.rs`): Implements vehicle-specific networking on top of raw CAN

Data flows through standard Linux socket system calls, with the bindings providing type-safe access to kernel CAN interfaces.

## Important Patterns

- **C Compatibility**: All structures and constants use C-compatible types for seamless kernel interface
- **Protocol Layering**: Raw CAN provides foundation, J1939 adds application semantics
- **Module Aggregation**: Private submodule declarations with selective public re-exports
- **Memory Alignment**: Consistent 8-byte alignment across frame structures
- **Error Handling**: Dedicated error queues and mask types for robust CAN error management

The module enables comprehensive CAN bus communication in Rust while maintaining full compatibility with Linux kernel CAN interfaces and existing C-based CAN applications.