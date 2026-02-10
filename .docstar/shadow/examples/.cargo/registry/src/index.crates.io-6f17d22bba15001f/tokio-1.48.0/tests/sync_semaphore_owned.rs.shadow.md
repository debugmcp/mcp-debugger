# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/sync_semaphore_owned.rs
@source-hash: da3b3b838fda0486
@generated: 2026-02-09T18:12:36Z

## Purpose
Test suite for Tokio's owned semaphore permits functionality, specifically testing `Semaphore::try_acquire_owned()`, `acquire_owned()`, and `try_acquire_many_owned()` methods that return ownership-holding permits.

## Test Structure
**Configuration**: Conditional compilation for `sync` feature (L1) and WASM compatibility (L3-4)

**Dependencies**: 
- `std::sync::Arc` for shared ownership (L6)
- `tokio::sync::Semaphore` for the tested functionality (L7)

## Key Test Functions

**try_acquire (L9-20)**: Basic owned permit acquisition
- Tests successful single permit acquisition with `Arc<Semaphore>`
- Verifies permit exclusivity (second acquire fails while first is held)
- Confirms permit release on drop enables reacquisition

**try_acquire_many (L22-36)**: Multi-permit owned acquisition
- Tests bulk permit acquisition (42 permits)
- Verifies remaining capacity calculations
- Tests partial acquisitions and resource exhaustion

**acquire (L38-49)**: Async owned permit acquisition
- Async test using `#[tokio::test]` requiring "full" feature
- Tests blocking acquisition via `acquire_owned().await`
- Uses task spawning to test cross-task permit passing

**acquire_many (L51-65)**: Async multi-permit acquisition  
- Complex async test with oneshot channel coordination
- Tests sequential async acquisitions with permit dependencies
- Demonstrates proper resource management across async boundaries

**add_permits (L67-77)**: Dynamic permit addition
- Tests `add_permits()` functionality with owned permits
- Verifies async tasks can unblock when permits are added

**forget (L79-90)**: Permit leak testing
- Tests `forget()` method that permanently consumes permits
- Verifies semaphore state after permit is forgotten (not returned)

**merge (L92-104)**: Permit consolidation
- Tests `merge()` method combining multiple owned permits
- Verifies permit count tracking and proper resource accounting

**merge_unrelated_permits (L106-115)**: Error handling
- Panic test for merging permits from different semaphores
- Conditional compilation excludes WASM (no unwinding support)

**split (L117-141)**: Permit subdivision
- Comprehensive test of `split()` method functionality
- Tests permit splitting, zero-permit splits, and resource tracking
- Verifies proper cleanup and permit return on drop

**stress_test (L143-164)**: Concurrency validation
- Spawns 1000 concurrent tasks acquiring owned permits
- Validates semaphore state consistency under high contention
- Confirms exact permit count after all tasks complete

## Architecture Patterns
- **Owned Permits**: All tests use `_owned()` variants that return permits tied to `Arc<Semaphore>`
- **RAII**: Extensive testing of permit cleanup via Drop trait
- **Async Coordination**: Uses oneshot channels and task spawning for async flow control
- **Resource Tracking**: Consistent validation of `available_permits()` state