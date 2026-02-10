# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/new/linux_uapi/linux/mod.rs
@source-hash: e9135b549d9427b9
@generated: 2026-02-09T17:58:13Z

**Purpose**: Module declaration file for Linux UAPI (User API) bindings within the libc crate. Acts as the entry point for Linux kernel user-space API definitions, specifically exposing CAN (Controller Area Network) protocol bindings.

**Module Structure**:
- `can` module (L3): Private submodule containing CAN protocol definitions from Linux UAPI
- Re-exports (L4): Public re-export of all items from the `can` module using glob import

**Architecture**: 
- Follows Rust's standard module organization pattern for system bindings
- Uses `pub(crate)` visibility to restrict module access to within the libc crate
- Employs re-export pattern to flatten module hierarchy for consumers

**Dependencies**:
- Part of libc crate's Linux-specific UAPI bindings
- Maps to Linux kernel's `include/uapi/linux/` directory structure
- Specifically provides userspace interface definitions for kernel APIs

**Key Pattern**: Module aggregation pattern - declares submodules privately then selectively re-exports their contents publicly, allowing internal organization while providing clean external interface.