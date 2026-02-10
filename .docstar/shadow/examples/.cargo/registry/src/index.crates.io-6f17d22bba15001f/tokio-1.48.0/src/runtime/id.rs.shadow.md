# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/id.rs
@source-hash: 70c3ddb1b9df7254
@generated: 2026-02-09T18:06:37Z

**Primary Purpose**: Defines a runtime identifier type for uniquely identifying Tokio runtime instances.

**Core Type**:
- `Id` (L37): Opaque wrapper around `NonZeroU64` that uniquely identifies a runtime instance
  - Implements `Clone`, `Copy`, `Debug`, `Hash`, `Eq`, `PartialEq` for value semantics
  - Uses `NonZeroU64` internally for memory efficiency and non-zero guarantee

**Key Behaviors**:
- Runtime IDs are unique only among *currently running* runtimes - IDs may be reused after runtime shutdown
- IDs are non-sequential and carry no ordering information
- Intended for debugging and runtime introspection via `Handle::current().id()`

**Conversions** (L39-49):
- `From<NonZeroU64>`: Direct wrapping conversion
- `From<NonZeroU32>`: Widens 32-bit to 64-bit non-zero value
- `Display` (L51-55): Forwards to inner `NonZeroU64` formatting

**Dependencies**:
- `std::num::{NonZeroU32, NonZeroU64}` for type-safe non-zero integers
- `std::fmt` for display formatting

**Architectural Notes**:
- Marked as unstable API (tokio_unstable feature gate)
- Part of Tokio's runtime identification system
- Designed as lightweight, copyable identifier for runtime instances