# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/new/linux_uapi/linux/can.rs
@source-hash: 5684eccda3fe635c
@generated: 2026-02-09T17:58:16Z

## Purpose
Linux CAN (Controller Area Network) protocol bindings for Rust's libc crate. Maps Linux kernel uapi headers for CAN bus communication, providing type definitions, constants, and data structures for different CAN protocols.

## Key Components

### Type Definitions
- `canid_t` (L20): Primary CAN identifier type (u32)
- `can_err_mask_t` (L26): Error mask type for CAN error handling

### CAN Frame Structures
- `can_frame` (L42-50): Standard CAN frame with 8-byte alignment
  - `can_id`: CAN identifier
  - `can_dlc`: Data length code (legacy field name)
  - `data`: Payload data array (max 8 bytes)
- `canfd_frame` (L59-66): CAN-FD (Flexible Data-rate) frame supporting up to 64 bytes
- `canxl_frame` (L74-81): CAN XL frame supporting up to 2048 bytes with priority-based addressing

### Protocol Constants
- CAN ID flags: `CAN_EFF_FLAG`, `CAN_RTR_FLAG`, `CAN_ERR_FLAG` (L11-13)
- ID masks: `CAN_SFF_MASK`, `CAN_EFF_MASK` for standard/extended frames (L15-17)
- Data length limits: `CAN_MAX_DLEN` (8), `CANFD_MAX_DLEN` (64), `CANXL_MAX_DLEN` (2048)
- Protocol identifiers: `CAN_RAW`, `CAN_BCM`, `CAN_ISOTP`, `CAN_J1939` (L94-101)

### Socket Address Structure
- `sockaddr_can` (L106-110): CAN socket address with protocol-specific union
- Anonymous unions for transport protocol (`tp`) and J1939 addressing

### Dependencies
- Uses `crate::prelude::*` for common libc types
- Re-exports from `j1939` and `raw` submodules (L6-7)
- References `size_of` for MTU calculations

### Architecture Notes
- All frame structures use 8-byte alignment for efficient memory access
- Supports three CAN variants: classic CAN, CAN-FD, and CAN XL
- Protocol-agnostic design allowing multiple CAN protocol implementations