# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/new/linux_uapi/linux/can/raw.rs
@source-hash: cc39efa823b9f4d1
@generated: 2026-02-09T17:57:07Z

**Purpose**: Provides Rust bindings for Linux CAN (Controller Area Network) raw socket constants from the kernel's `linux/can/raw.h` header file. Part of the libc crate's Linux UAPI bindings.

**Key Constants**:
- `SOL_CAN_RAW` (L5): Socket level constant for CAN raw protocol, calculated as `SOL_CAN_BASE + CAN_RAW`
- `CAN_RAW_FILTER_MAX` (L6): Maximum number of CAN filters (512)
- Socket option constants (L9-14):
  - `CAN_RAW_FILTER` (L9): Enable/disable CAN ID filtering
  - `CAN_RAW_ERR_FILTER` (L10): Error frame filtering control
  - `CAN_RAW_LOOPBACK` (L11): Local loopback of sent frames
  - `CAN_RAW_RECV_OWN_MSGS` (L12): Receive own transmitted messages
  - `CAN_RAW_FD_FRAMES` (L13): CAN FD (Flexible Data-Rate) frame support
  - `CAN_RAW_JOIN_FILTERS` (L14): Join multiple filters with AND logic
  - `CAN_RAW_XL_FRAMES` (L15): CAN XL frame support

**Dependencies**:
- Re-exports from `crate::linux::can::*` (L3) for base CAN types and constants
- Uses `c_int` type for C compatibility

**Architecture**: Simple constant definitions module following Linux kernel UAPI structure. All constants are `pub` for external use in CAN socket programming.

**Usage Context**: These constants are used with `setsockopt()`/`getsockopt()` system calls to configure CAN raw socket behavior in Linux CAN network programming.