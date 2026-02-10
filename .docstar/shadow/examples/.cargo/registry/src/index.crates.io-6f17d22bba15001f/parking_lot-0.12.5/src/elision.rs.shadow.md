# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/parking_lot-0.12.5/src/elision.rs
@source-hash: 7070a29080f4c7d3
@generated: 2026-02-09T18:11:39Z

## Primary Purpose
Provides hardware transactional memory (HTM) lock elision support for x86/x86_64 architectures using Intel TSX instructions. Implements atomic operations with hardware lock elision to potentially improve performance by executing lock-protected sections speculatively without acquiring the actual lock.

## Key Components

### `AtomicElisionExt` trait (L11-23)
Extension trait that adds lock elision primitives to atomic types:
- `elision_compare_exchange_acquire()` (L15-19): Performs atomic compare-exchange with transaction start
- `elision_fetch_sub_release()` (L22): Performs atomic fetch-subtract with transaction end
- Associated type `IntType` for the underlying integer type

### `have_elision()` function (L27-33)
Runtime capability detection that returns `true` only when:
- `hardware-lock-elision` feature is enabled
- Not running under Miri
- Target architecture is x86 or x86_64

### Fallback Implementation (L42-54)
Stub implementation for unsupported platforms that calls `unreachable!()` for both trait methods. Protected by inverse feature gate - should never execute when `have_elision()` returns false.

### Hardware Implementation (L61-119)
Real TSX-based implementation for supported x86/x86_64 platforms:

**`elision_compare_exchange_acquire()` (L65-93)**:
- Uses inline assembly with `xacquire` prefix and `lock cmpxchg` instruction
- Separate assembly blocks for 32-bit (L70-77) and 64-bit (L79-86) pointer widths
- Returns `Result<usize, usize>` following standard compare_exchange semantics

**`elision_fetch_sub_release()` (L96-118)**:
- Uses inline assembly with `xrelease` prefix and `lock xadd` instruction  
- Implements subtraction via addition of two's complement (`val.wrapping_neg()`)
- Separate assembly blocks for 32-bit (L101-107) and 64-bit (L109-115) pointer widths

## Dependencies
- `std::sync::atomic::AtomicUsize` (L8)
- `core::arch::asm` for inline assembly (L67, L98)

## Architectural Decisions
- Conditional compilation ensures only one implementation exists at build time
- Uses TSX `xacquire`/`xrelease` prefixes for hardware lock elision
- Follows standard atomic operation result semantics
- Platform-specific assembly for 32/64-bit pointer width handling