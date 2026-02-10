# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/process/kill.rs
@source-hash: 2f98bd1bd28ab37b
@generated: 2026-02-09T18:06:33Z

**Purpose**: Defines a trait interface for forcefully terminating running processes within Tokio's process management system.

**Core Components**:
- `Kill` trait (L4-7): Internal trait defining the contract for process termination
  - `kill()` method (L6): Returns `io::Result<()>`, providing standard error handling for process termination failures
  - Marked `pub(crate)` for internal Tokio use only

**Implementations**:
- Blanket implementation for mutable references (L9-13): Enables `Kill` trait usage through mutable references by dereferencing and delegating to the underlying implementation

**Dependencies**:
- `std::io`: For `Result` type and I/O error handling

**Architectural Notes**:
- Trait-based design allows for multiple process killing strategies (platform-specific implementations)
- Mutable reference requirement indicates process state may be modified during termination
- Part of Tokio's process management abstraction layer