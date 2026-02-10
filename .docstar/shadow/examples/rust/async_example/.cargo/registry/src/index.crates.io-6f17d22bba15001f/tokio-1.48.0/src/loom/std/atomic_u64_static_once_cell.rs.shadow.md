# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/loom/std/atomic_u64_static_once_cell.rs
@source-hash: 3ed7c98c5f402b09
@generated: 2026-02-09T18:02:50Z

## Loom Mock Atomic U64 Implementation

This file provides two atomic-like implementations for the `loom` testing framework, designed to simulate atomic operations using mutexes for concurrent testing scenarios.

### Core Components

**StaticAtomicU64 (L5-8)**: A static-safe atomic u64 wrapper using lazy initialization
- `init: u64` - Initial value to set when first accessed
- `cell: OnceLock<Mutex<u64>>` - Thread-safe lazy initialization container

**AtomicU64 impl (L10-16)**: Standard constructor for the main AtomicU64 type
- `new(val: u64)` - Creates new instance with mutex-wrapped value

**StaticAtomicU64 impl (L18-57)**: Main implementation providing atomic-like operations
- `new(val: u64) -> StaticAtomicU64` (L19-24) - Const constructor for static contexts
- `load(order: Ordering) -> u64` (L26-28) - Atomic load operation
- `fetch_add(val: u64, order: Ordering) -> u64` (L30-35) - Atomic fetch-and-add
- `compare_exchange_weak()` (L37-52) - Weak compare-and-swap operation
- `inner() -> &Mutex<u64>` (L54-56) - Lazy initialization helper using OnceLock

### Key Dependencies
- `super::AtomicU64` - Main atomic type being extended
- `crate::loom::sync::{atomic::Ordering, Mutex}` - Loom's sync primitives
- `std::sync::OnceLock` - Standard library's one-time initialization

### Architecture Notes
- Uses mutex-based synchronization instead of real atomics for loom testing
- Lazy initialization pattern via OnceLock enables const construction
- Ordering parameters are ignored in mock implementation (unused prefixes on L41-42)
- All operations are mutex-guarded, providing sequential consistency regardless of ordering parameter