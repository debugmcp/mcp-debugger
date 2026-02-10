# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/time/error.rs
@source-hash: 48dee729b01f8fe1
@generated: 2026-02-09T18:06:47Z

**Primary Purpose:** Defines error types for Tokio's timer implementation, handling timer operation failures and timeout scenarios.

**Key Types:**

- `Error` (L26): Main timer error type wrapping internal `Kind` enum. Provides factory methods and inspection utilities for different error conditions.
- `Kind` (L28-34): Internal error variant enum with explicit `u8` representation:
  - `Shutdown = 1`: Timer instance dropped, permanent failure
  - `AtCapacity = 2`: Timer at maximum capacity, transient failure  
  - `Invalid = 3`: Timer misconfiguration (duration exceeds limits)
- `Elapsed` (L47): Timeout-specific error for when operations exceed their deadline
- `InsertError` (L50-52): Internal enum for timer insertion failures

**Key Methods:**

- `Error` factory methods (L58-85): `shutdown()`, `at_capacity()`, `invalid()` constructors and corresponding `is_*()` inspection methods
- `Elapsed::new()` (L106-108): Internal constructor for timeout errors
- Display implementations (L90-101, L111-115): Human-readable error messages

**Important Traits:**

- `Error` implements `std::error::Error` (L88) and `Display` (L90-101)
- `Elapsed` implements `std::error::Error` (L117) and `Display` (L111-115)
- `From<Elapsed>` for `std::io::Error` (L119-123): Converts timeout to `TimedOut` IO error

**Architectural Notes:**

- Uses newtype pattern for `Error` wrapping `Kind` enum
- `Kind` has explicit numeric representation for potential serialization/debugging
- Error types distinguish between permanent (shutdown) and transient (at capacity) failures
- Documentation references load shedding strategies for capacity errors
- Clean separation between timer operation errors (`Error`) and timeout errors (`Elapsed`)

**Dependencies:** Only standard library (`std::error`, `std::fmt`, `std::io`)