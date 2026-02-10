# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/macros/pin.rs
@source-hash: d8347f8258e8fecc
@generated: 2026-02-09T18:06:36Z

**Purpose**: Provides the `pin!` macro for stack-pinning Rust futures and other `!Unpin` types, enabling safe polling of futures through mutable references without heap allocation.

## Core Macro Definition

**`pin!` macro (L125-144)**: Two-variant macro for pinning values on the stack:

1. **Identifier variant (L126-135)**: `pin!(future1, future2, ...)` - Accepts comma-separated identifiers, moves each value and shadows the original binding with an unsafe `Pin<&mut T>` wrapper
2. **Declaration variant (L136-143)**: `pin! { let var = expr; ... }` - Combines variable assignment with pinning in a single block syntax

## Implementation Details

The macro uses a two-step shadowing pattern:
- First move: `let mut $x = $x` ensures ownership transfer
- Second shadow: Creates `Pin<&mut T>` via `Pin::new_unchecked()` with `#[allow(unused_mut)]` attribute

**Safety**: Uses `unsafe { Pin::new_unchecked() }` but maintains safety through the shadowing pattern that prevents direct access to the original unpinned value.

## Use Cases

- **Future polling**: Required when `.await`ing on `&mut future` references instead of consuming futures directly
- **`select!` macro**: Enables concurrent polling of multiple futures that must remain accessible
- **Stream operations**: Supports stream combinators requiring `T: Stream + Unpin` bounds
- **Performance**: Avoids heap allocation compared to `Box::pin()`

## Key Constraints

- **Identifiers only**: Macro accepts identifiers, not arbitrary expressions
- **Stack lifetime**: Pinned values are bound to current stack frame
- **Move semantics**: Original bindings become inaccessible after pinning

**Dependencies**: 
- `$crate::macros::support::Pin` for the pinning primitive
- Standard library `Future` trait concepts