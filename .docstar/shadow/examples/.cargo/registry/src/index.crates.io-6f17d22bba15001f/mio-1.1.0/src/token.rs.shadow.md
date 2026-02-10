# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/token.rs
@source-hash: 4e64c8e337fbee4e
@generated: 2026-02-09T18:11:35Z

**Primary Purpose**: Simple wrapper type around `usize` that serves as an identifier for associating I/O readiness events with event sources in the mio async I/O library.

**Core Structure**:
- `Token` struct (L132): Tuple struct containing a single `usize` field, designed as a lightweight identifier for event sources
- Implements standard traits: Copy, Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash for comprehensive usability

**Key Functionality**:
- `From<Token> for usize` implementation (L134-138): Provides conversion from Token back to its underlying usize value
- Public field access: The `usize` field is public, allowing direct construction and access via `Token(value)` syntax

**Integration Points**:
- Used with `Registry::register` and `Registry::reregister` for event source registration
- Retrieved from events via `event.token()` to identify which source triggered the event
- Commonly used in event loops to match events back to their originating sources

**Usage Patterns**:
- Typically used as HashMap keys or array indices to associate event sources with application state
- Common pattern: assign unique tokens to each socket/connection (as shown in extensive example L20-130)
- Often paired with data structures like `slab` crate for efficient token-to-object mapping

**Architectural Design**:
- Zero-cost abstraction: struct is essentially a type-safe wrapper around `usize`
- Derives all common traits making it suitable for use in collections and comparisons
- Public field design allows direct construction without constructor methods