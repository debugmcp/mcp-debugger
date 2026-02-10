# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/proc-macro2-1.0.103/src/num.rs
@source-hash: 82d625cbcd255965
@generated: 2026-02-09T18:11:40Z

## Purpose
Provides a custom non-zero character type for proc-macro2, wrapping Rust's `char` type with null character exclusion. Serves as a temporary implementation until Rust 1.89+ when `NonZero<char>` becomes available.

## Key Components

### NonZeroChar struct (L2-3)
- Custom wrapper around `char` that guarantees the wrapped character is not null (`'\0'`)
- Derives standard traits: Copy, Clone, Debug, PartialEq, Eq
- Single field tuple struct containing the wrapped character

### Constructor (L6-12)
- `new(ch: char) -> Option<Self>`: Safe constructor that returns `None` if input is null character, `Some(NonZeroChar)` otherwise
- Validates input at construction time to maintain invariant

### Accessor (L14-16)
- `get(self) -> char`: Returns the wrapped character value
- Takes self by value (since Copy is implemented)

## Architectural Notes
- Follows Rust's non-zero type pattern similar to `NonZeroU32`, etc.
- Designed as temporary solution with explicit migration path noted in TODO
- Zero-cost abstraction - no runtime overhead beyond construction validation
- Maintains type safety through Option return type in constructor