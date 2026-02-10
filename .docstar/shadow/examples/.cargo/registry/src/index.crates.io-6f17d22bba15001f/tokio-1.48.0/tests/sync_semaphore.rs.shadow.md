# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/sync_semaphore.rs
@source-hash: f23fb6b933db47f5
@generated: 2026-02-09T18:12:33Z

## Purpose
Comprehensive test suite for Tokio's `Semaphore` synchronization primitive, validating core functionality including permit acquisition, release, manipulation operations, and edge cases.

## Key Dependencies
- `std::sync::Arc` (L6) - For shared ownership in concurrent tests
- `tokio::sync::Semaphore` (L7) - Primary test target
- Platform-specific test attributes for WASM compatibility (L3-4)

## Test Categories

### Basic Operations
- **no_permits** (L9-13): Validates semaphore creation with zero permits doesn't panic
- **try_acquire** (L15-26): Tests synchronous permit acquisition and automatic release via RAII

### Async Operations (requires "full" feature)
- **acquire** (L28-39): Tests async permit acquisition across tasks with Arc sharing
- **add_permits** (L41-51): Validates dynamic permit addition unblocks waiting tasks

### Permit Manipulation
- **forget** (L53-64): Tests permanent permit consumption via `forget()` method
- **merge** (L66-78): Validates combining multiple permits into single guard
- **merge_unrelated_permits** (L80-89): Panic test for merging permits from different semaphores
- **split** (L91-115): Comprehensive testing of permit subdivision with various edge cases

### Stress Testing
- **stress_test** (L117-138): Concurrent test with 1000 tasks validating semaphore integrity under load

### Boundary Conditions
- **add_max_amount_permits** (L140-145): Tests adding maximum allowed permits (MAX_PERMITS)
- **add_more_than_max_amount_permits1/2** (L147-162): Panic tests for permit overflow scenarios
- **panic_when_exceeds_maxpermits** (L164-169): Constructor overflow validation  
- **no_panic_at_maxpermits** (L171-176): Boundary condition for maximum valid permit count

## Key Patterns
- Extensive use of `Arc<Semaphore>` for shared access testing
- RAII-based permit management validation through scope-based drops
- Platform-conditional compilation for WASM compatibility
- Feature-gated async tests requiring "full" feature set
- Systematic boundary testing around `Semaphore::MAX_PERMITS`

## Critical Invariants
- Permits are properly released when guards are dropped
- Available permit count accurately reflects current state
- Concurrent access maintains semaphore integrity
- Permit operations respect maximum count limits