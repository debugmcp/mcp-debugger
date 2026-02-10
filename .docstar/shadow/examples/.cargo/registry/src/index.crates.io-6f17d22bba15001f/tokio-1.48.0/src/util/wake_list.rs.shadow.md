# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/util/wake_list.rs
@source-hash: bba6898b54d87417
@generated: 2026-02-09T18:06:51Z

**Primary Purpose:** A fixed-capacity container for collecting and batch-waking async task wakers in Tokio's runtime. Optimized for scenarios where multiple tasks need to be awakened simultaneously without dynamic allocation.

**Core Structure:**
- `WakeList` (L12-15): Fixed-size array of 32 `MaybeUninit<Waker>` slots with a current count tracker
- Critical invariant: First `curr` elements are always initialized, remaining slots are uninitialized

**Key Methods:**
- `new()` (L18-25): Creates empty wake list with all slots uninitialized
- `can_push()` (L28-30): Checks if there's capacity for more wakers (curr < 32)
- `push()` (L32-37): Adds waker to next available slot, increments counter. Debug-asserts capacity check
- `wake_all()` (L39-73): Batch wakes all stored wakers using custom drop guard for exception safety

**Memory Management Pattern:**
The `wake_all()` method uses a sophisticated RAII pattern with `DropGuard` (L40-53) to ensure all wakers are properly dropped even if `wake()` panics. The guard manages raw pointers and uses `ptr::drop_in_place` for cleanup.

**Safety Characteristics:**
- Uses `MaybeUninit` for uninitialized memory management
- Extensive unsafe pointer arithmetic with detailed safety comments
- Exception-safe cleanup via drop guards
- Manual drop implementation (L76-82) for proper waker cleanup

**Performance Design:**
- Fixed 32-waker capacity to avoid allocations
- Inline capacity check for hot path optimization
- Batch processing reduces syscall overhead for multi-waker scenarios

**Dependencies:**
- `std::task::Waker` for async runtime integration
- `core::mem::MaybeUninit` for safe uninitialized memory
- `core::ptr` for low-level pointer operations