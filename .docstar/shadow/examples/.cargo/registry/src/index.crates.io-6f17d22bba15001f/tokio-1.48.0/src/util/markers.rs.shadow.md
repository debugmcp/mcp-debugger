# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/util/markers.rs
@source-hash: 4f20e670ca3e9e77
@generated: 2026-02-09T18:06:43Z

**Purpose**: Utility module providing marker types to control `Send` and `Sync` trait implementations in Tokio's type system.

**Key Types**:
- `SyncNotSend` (L3): Zero-sized marker struct that implements `Sync` but deliberately excludes `Send` through raw pointer field
- `NotSendOrSync` (L8): Conditionally compiled marker that implements neither `Send` nor `Sync`

**Implementation Details**:
- `SyncNotSend` uses `*mut ()` field to make type `!Send` by default (L3)
- Manual `unsafe impl Sync` override (L5) grants thread-safe sharing while maintaining `!Send`
- `NotSendOrSync` available only when runtime features are enabled via `cfg_rt!` macro (L7-9)

**Architectural Role**:
These markers serve as compile-time safety mechanisms in Tokio's async runtime, allowing fine-grained control over thread safety guarantees. They're likely embedded in other types to enforce specific threading constraints without runtime overhead.

**Usage Pattern**: 
Phantom data pattern for zero-cost abstractions that encode thread safety properties into the type system.