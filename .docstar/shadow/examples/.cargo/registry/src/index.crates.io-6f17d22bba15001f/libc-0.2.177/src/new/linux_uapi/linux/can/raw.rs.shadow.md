# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/new/linux_uapi/linux/can/raw.rs
@source-hash: cc39efa823b9f4d1
@generated: 2026-02-09T18:02:09Z

## Primary Purpose
Linux CAN (Controller Area Network) raw socket constants and definitions, providing a Rust FFI interface to the Linux kernel's CAN raw socket API defined in `linux/can/raw.h`.

## Key Elements
- **SOL_CAN_RAW constant (L5)**: Socket option level for CAN raw sockets, calculated as `SOL_CAN_BASE + CAN_RAW`
- **CAN_RAW_FILTER_MAX constant (L6)**: Maximum number of CAN filters (512)
- **Socket option constants (L9-15)**: CAN raw socket configuration options:
  - `CAN_RAW_FILTER`: Message filtering configuration
  - `CAN_RAW_ERR_FILTER`: Error frame filtering 
  - `CAN_RAW_LOOPBACK`: Loopback control
  - `CAN_RAW_RECV_OWN_MSGS`: Receive own transmitted messages
  - `CAN_RAW_FD_FRAMES`: CAN-FD frame support
  - `CAN_RAW_JOIN_FILTERS`: Filter joining behavior
  - `CAN_RAW_XL_FRAMES`: CAN-XL frame support

## Dependencies
- **Re-export (L3)**: Uses `crate::linux::can::*` for base CAN types and constants (`SOL_CAN_BASE`, `CAN_RAW`)
- **c_int type**: Standard C integer type for Linux system call interface

## Architectural Notes
This module follows the libc crate pattern of providing direct 1:1 mappings to C constants for system programming. The constants use sequential integer values (1-7) following Linux kernel conventions for socket option enumeration.