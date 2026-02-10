# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/smallvec-1.15.1/src/tests.rs
@source-hash: 77d7dac593a3d422
@generated: 2026-02-09T18:11:59Z

## SmallVec Test Suite

This test file provides comprehensive coverage for the SmallVec data structure, testing both inline (stack-allocated) and spilled (heap-allocated) storage modes.

### Core Functionality Tests

**Basic Operations (L10-73):**
- `test_zero()` (L11-17): Tests zero-capacity SmallVec behavior and spilling detection
- `test_inline()` (L22-27): Validates inline storage with strings
- `test_spill()` (L30-47): Tests transition from inline to heap storage
- `test_double_spill()` (L50-73): Validates multiple heap reallocations

**Capacity Management (L87-98, L225-241):**
- `test_with_capacity()` (L88-98): Tests pre-allocation behavior for both inline and heap modes
- `test_capacity()` (L225-241): Validates reserve, reserve_exact, and shrink_to_fit operations

**Iterator Tests (L101-222):**
- `drain()` (L101-121): Tests draining with range syntax, capacity preservation
- `into_iter()` (L144-155): Tests consuming iteration for both storage modes
- `into_iter_drop()` (L172-222): Complex drop behavior testing with custom DropCounter type

### Advanced Operations

**Insertion/Removal (L263-328):**
- `test_insert_many()` (L263-274): Tests bulk insertion functionality
- `MockHintIter` (L276-288): Helper struct for testing size hint handling
- Tests for incorrect size hints (L291-328)

**Panic Safety (L331-423):**
- `insert_many_panic` module (L331-423): Comprehensive panic safety testing
- `PanicOnDoubleDrop` (L335-352): Ensures no double-drops during panics
- `BadIter` (L355-372): Iterator that panics after yielding some items

### Memory Management & Edge Cases

**Growth/Shrinking (L691-702, L855-869):**
- `shrink_to_fit_unspill()` (L691-697): Tests transition back to inline storage
- `grow_to_shrink()` (L855-869): Tests growing to smaller capacity

**Conversion Methods (L598-626, L721-751):**
- `test_from()` (L598-626): Tests From trait implementations for various types
- `test_from_vec()` (L721-751): Tests Vec to SmallVec conversion

**Trait Implementations:**
- Equality/Ordering (L486-522): Tests PartialEq, Eq, PartialOrd, Ord
- Hashing (L525-543): Tests Hash trait implementation
- Borrowing (L570-595): Tests AsRef, AsMut, Borrow, BorrowMut traits

### Feature-Gated Tests

**Optional Features:**
- `test_write()` (L819-833): Write trait implementation (feature="write")
- `test_serde()` (L836-852): Serialization tests (feature="serde") 
- `const_new()` (L911-949): Const constructor tests (feature="const_new")
- `drain_filter()` (L1019-1027): Conditional removal (feature="drain_filter")
- `test_bincode()` (L1076-1136): Binary encoding tests (feature="impl_bincode")

### Safety & Edge Case Testing

**Boundary Conditions (L1043-1074):**
- Tests operations with `usize::MAX` indices to prevent UB
- Validates panic behavior for out-of-bounds operations

**Special Cases:**
- `uninhabited()` (L884-888): Tests with uninhabited enum types
- `zero_size_items()` (L957-959): Tests with zero-sized types
- Memory layout validation (L996-1016): Tests struct size under different feature flags

### Architecture Notes

The test suite emphasizes the dual-mode nature of SmallVec (inline vs spilled storage) and thoroughly validates the transition between modes. Tests use string allocations to detect memory safety issues under valgrind (L19 comment). The comprehensive panic safety testing ensures proper cleanup during unwinding scenarios.